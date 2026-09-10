import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export const IDEMPOTENCY_RECORD_TTL_SECONDS = 24 * 60 * 60;

export interface StoredResponse {
  statusCode: number;
  body: unknown;
}

@Schema({ collection: 'idempotency_records', versionKey: false })
export class IdempotencyRecord {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  requestFingerprint: string;

  @Prop({ type: String, required: true, enum: ['in_progress', 'completed'] })
  status: 'in_progress' | 'completed';

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  response: StoredResponse | null;

  @Prop({ type: Date, required: true })
  claimedAt: Date;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;
}

export type IdempotencyRecordDocument = HydratedDocument<IdempotencyRecord>;

export const IdempotencyRecordSchema = SchemaFactory.createForClass(IdempotencyRecord);

IdempotencyRecordSchema.index({ claimedAt: 1 }, { expireAfterSeconds: IDEMPOTENCY_RECORD_TTL_SECONDS });
