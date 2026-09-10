import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { type ClientSession, Connection } from 'mongoose';
import { setTimeout as sleep } from 'node:timers/promises';
import { ConcurrentModificationError } from '../common/errors/domain-error';

const MAX_ATTEMPTS = 12;
const BASE_BACKOFF_MS = 15;
const MAX_BACKOFF_MS = 250;

export type TransactionalWork<T> = (session: ClientSession) => Promise<T>;

/**
 * Runs a unit of work in one MongoDB transaction with snapshot isolation. When two transactions
 * write the same asset document, MongoDB aborts the later one with a transient WriteConflict;
 * the work is then re-run from scratch against the committed state, where the domain checks
 * produce the proper refusal. Retries back off with jitter so a burst of losers does not spin.
 */
@Injectable()
export class TransactionRunner {
  private readonly logger = new Logger(TransactionRunner.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async run<T>(work: TransactionalWork<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      const session = await this.connection.startSession();
      try {
        return await this.runOnce(session, work);
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS || !isRetryable(error)) {
          throw error;
        }
        this.logger.warn(`Transaction attempt ${attempt} conflicted, retrying: ${describe(error)}`);
        await sleep(backoffMillis(attempt));
      } finally {
        await session.endSession();
      }
    }
  }

  private async runOnce<T>(session: ClientSession, work: TransactionalWork<T>): Promise<T> {
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
    try {
      const outcome = await work(session);
      await session.commitTransaction();
      return outcome;
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    }
  }
}

function backoffMillis(attempt: number): number {
  const ceiling = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
  return Math.floor(Math.random() * ceiling);
}

function isRetryable(error: unknown): boolean {
  if (error instanceof ConcurrentModificationError) {
    return true;
  }
  return hasErrorLabel(error, 'TransientTransactionError');
}

function hasErrorLabel(error: unknown, label: string): boolean {
  if (typeof error !== 'object' || error === null || !('hasErrorLabel' in error)) {
    return false;
  }
  const check = error.hasErrorLabel;
  return typeof check === 'function' && Boolean(check.call(error, label));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
