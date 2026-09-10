import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  CORRECTABLE_FIELDS,
  CORRECTION_KINDS,
  type CorrectableField,
  type CorrectionKind,
} from '@equipment-ledger/shared';
import { Types } from 'mongoose';

@Schema({ _id: false })
export class CorrectionChangeRecord {
  @Prop({ type: String, required: true, enum: CORRECTABLE_FIELDS })
  field: CorrectableField;

  @Prop({ type: String, default: null })
  from: string | null;

  @Prop({ type: String, default: null })
  to: string | null;
}

const CorrectionChangeSchema = SchemaFactory.createForClass(CorrectionChangeRecord);

@Schema({ collection: 'corrections', versionKey: false })
export class CorrectionRecord {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true })
  assetId: string;

  @Prop({ type: Types.ObjectId, required: true })
  originalMovementId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  replacementMovementId: Types.ObjectId | null;

  @Prop({ type: String, required: true, enum: CORRECTION_KINDS })
  kind: CorrectionKind;

  @Prop({ type: String, required: true })
  reason: string;

  @Prop({ type: String, required: true })
  keeperId: string;

  @Prop({ type: Date, required: true })
  recordedAt: Date;

  @Prop({ type: [CorrectionChangeSchema], default: [] })
  changes: CorrectionChangeRecord[];
}

export const CorrectionSchema = SchemaFactory.createForClass(CorrectionRecord);

CorrectionSchema.index({ originalMovementId: 1 }, { unique: true });
CorrectionSchema.index({ assetId: 1, recordedAt: -1 });
