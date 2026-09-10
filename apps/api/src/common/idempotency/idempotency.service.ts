import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RuleViolationError, StateConflictError } from '../errors/domain-error';
import { IdempotencyRecord, type StoredResponse } from './idempotency-record.schema';

const STALE_CLAIM_AFTER_MS = 30_000;
const DUPLICATE_KEY_ERROR = 11000;

export type ClaimOutcome = { kind: 'owned' } | { kind: 'replay'; response: StoredResponse };

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
    try {
      await this.records.create({
        _id: idempotencyKey,
        requestFingerprint,
        status: 'in_progress',
        response: null,
        claimedAt: now,
        completedAt: null,
      });
      return { kind: 'owned' };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
    return this.resolveExistingClaim(idempotencyKey, requestFingerprint, now);
  }

  async complete(idempotencyKey: string, response: StoredResponse, now: Date): Promise<void> {
    await this.records.updateOne(
      { _id: idempotencyKey },
      { $set: { status: 'completed', response, completedAt: now } },
    );
  }

  async release(idempotencyKey: string): Promise<void> {
    await this.records.deleteOne({ _id: idempotencyKey, status: 'in_progress' });
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
    const takenOver = await this.records.findOneAndUpdate(
      {
        _id: idempotencyKey,
        status: 'in_progress',
        claimedAt: { $lt: new Date(now.getTime() - STALE_CLAIM_AFTER_MS) },
      },
      { $set: { claimedAt: now } },
    );
    if (takenOver) {
      this.logger.warn(`Taking over stale in-progress Idempotency-Key ${idempotencyKey}`);
      return { kind: 'owned' };
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
