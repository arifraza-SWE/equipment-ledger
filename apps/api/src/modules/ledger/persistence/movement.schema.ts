import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MOVEMENT_TYPES, type MovementType } from '@equipment-ledger/shared';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'movements', versionKey: false })
export class MovementRecord {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true })
  assetId: string;

  @Prop({ type: String, required: true, enum: MOVEMENT_TYPES })
  type: MovementType;

  @Prop({ type: String, default: null })
  workerId: string | null;

  @Prop({ type: String, default: null })
  returnedByWorkerId: string | null;

  @Prop({ type: String, required: true })
  keeperId: string;

  @Prop({ type: Date, required: true })
  effectiveAt: Date;

  @Prop({ type: Date, required: true })
  recordedAt: Date;

  @Prop({ type: Date, default: null })
  dueAt: Date | null;

  @Prop({ type: Types.ObjectId, default: null })
  reservationId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  note: string | null;

  @Prop({ type: Number, required: true })
  sequence: number;

  @Prop({ type: Types.ObjectId, default: null })
  supersededByCorrectionId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  createdByCorrectionId: Types.ObjectId | null;
}

export type MovementDocument = HydratedDocument<MovementRecord>;

export const MovementSchema = SchemaFactory.createForClass(MovementRecord);

MovementSchema.index({ assetId: 1, effectiveAt: 1, sequence: 1 });
MovementSchema.index({ supersededByCorrectionId: 1, effectiveAt: 1 });
MovementSchema.index({ workerId: 1, effectiveAt: -1 });
MovementSchema.index({ recordedAt: -1, _id: -1 });
