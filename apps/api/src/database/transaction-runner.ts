import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { type ClientSession, Connection } from 'mongoose';
import { ConcurrentModificationError } from '../common/errors/domain-error';

const MAX_ATTEMPTS = 4;

export type TransactionalWork<T> = (session: ClientSession) => Promise<T>;

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
        if (attempt < MAX_ATTEMPTS && isRetryable(error)) {
          this.logger.warn(`Transaction attempt ${attempt} conflicted, retrying: ${describe(error)}`);
          continue;
        }
        throw error;
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
  const check = (error as { hasErrorLabel: unknown }).hasErrorLabel;
  return typeof check === 'function' && Boolean(check.call(error, label));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
