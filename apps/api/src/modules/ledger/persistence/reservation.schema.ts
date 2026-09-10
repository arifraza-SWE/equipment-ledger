import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { RESERVATION_STATUSES, type ReservationStatus } from '@equipment-ledger/shared';
import { Types } from 'mongoose';

@Schema({ collection: 'reservations', versionKey: false })
export class ReservationRecord {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true })
  assetId: string;

  @Prop({ type: String, required: true })
  workerId: string;

  @Prop({ type: String, required: true })
  keeperId: string;

  @Prop({ type: Date, required: true })
  startsAt: Date;

  @Prop({ type: Date, required: true })
  endsAt: Date;

  @Prop({ type: String, required: true, enum: RESERVATION_STATUSES })
  status: ReservationStatus;

  @Prop({ type: String, default: null })
  note: string | null;

  @Prop({ type: Date, required: true })
  createdAt: Date;

  @Prop({ type: Types.ObjectId, default: null })
  fulfilledByMovementId: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  closedAt: Date | null;

  @Prop({ type: String, default: null })
  closedReason: string | null;
}

export const ReservationSchema = SchemaFactory.createForClass(ReservationRecord);

ReservationSchema.index({ assetId: 1, status: 1, startsAt: 1 });
ReservationSchema.index({ workerId: 1, startsAt: -1 });
ReservationSchema.index({ endsAt: 1, startsAt: 1 });
