import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { RuleViolationError, StateConflictError } from '../errors/domain-error';
import { IdempotencyRecord, type StoredResponse } from './idempotency-record.schema';

/**
 * Long enough that a claim is only ever taken over once the original request cannot still be
 * running: MongoDB kills a transaction at 60 seconds, so anything older than this is dead.
 * A takeover re-runs the command, which the ledger's own invariants then refuse if the first
 * attempt had already committed.
 */
export const STALE_CLAIM_AFTER_MS = 120_000;
const DUPLICATE_KEY_ERROR = 11000;

export type ClaimOutcome =
  { kind: 'owned'; claimToken: string } | { kind: 'replay'; response: StoredResponse };

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectModel(IdempotencyRecord.name) private readonly records: Model<IdempotencyRecord>,
  ) {}

  async claim(
    idempotencyKey: string,
    requestFingerprint: string,
    now: Date,
  ): Promise<ClaimOutcome> {
    const claimToken = randomUUID();
    try {
      await this.records.create({
        _id: idempotencyKey,
        requestFingerprint,
        status: 'in_progress',
        response: null,
        claimToken,
        claimedAt: now,
        completedAt: null,
      });
      return { kind: 'owned', claimToken };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
    return this.resolveExistingClaim(idempotencyKey, requestFingerprint, now);
  }

  /**
   * Only the request that still holds the claim may write its answer. Without the token a slow
   * first attempt could overwrite the answer of the retry that took the claim over, and every
   * later replay would then be told the wrong thing.
   */
  async complete(
    idempotencyKey: string,
    claimToken: string,
    response: StoredResponse,
    now: Date,
  ): Promise<void> {
    const outcome = await this.records.updateOne(
      { _id: idempotencyKey, claimToken },
      { $set: { status: 'completed', response, completedAt: now } },
    );
    if (outcome.matchedCount === 0) {
      this.logger.warn(
        `Idempotency-Key ${idempotencyKey} was taken over by another request; not overwriting its answer.`,
      );
    }
  }

  async release(idempotencyKey: string, claimToken: string): Promise<void> {
    await this.records.deleteOne({ _id: idempotencyKey, claimToken, status: 'in_progress' });
  }

  private async resolveExistingClaim(
    idempotencyKey: string,
    requestFingerprint: string,
    now: Date,
  ): Promise<ClaimOutcome> {
    const existing = await this.records.findById(idempotencyKey).lean();
    if (!existing) {
      return this.claim(idempotencyKey, requestFingerprint, now);
    }
    if (existing.requestFingerprint !== requestFingerprint) {
      throw new RuleViolationError(
        'idempotency_key_reused',
        'This Idempotency-Key was already used for a different request. Generate a new key for a new request.',
        { idempotencyKey },
      );
    }
    if (existing.status === 'completed' && existing.response) {
      this.logger.log(`Replaying stored response for Idempotency-Key ${idempotencyKey}`);
      return { kind: 'replay', response: existing.response };
    }
    const claimToken = randomUUID();
    const takenOver = await this.records.findOneAndUpdate(
      {
        _id: idempotencyKey,
        status: 'in_progress',
        claimedAt: { $lt: new Date(now.getTime() - STALE_CLAIM_AFTER_MS) },
      },
      { $set: { claimedAt: now, claimToken } },
    );
    if (takenOver) {
      this.logger.warn(`Taking over stale in-progress Idempotency-Key ${idempotencyKey}`);
      return { kind: 'owned', claimToken };
    }
    throw new StateConflictError(
      'idempotency_in_progress',
      'An identical request is still being processed. Wait for it to finish, then refresh to see the result.',
      { idempotencyKey },
    );
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === DUPLICATE_KEY_ERROR
  );
}
