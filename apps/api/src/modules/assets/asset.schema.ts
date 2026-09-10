import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  ASSET_KINDS,
  type AssetKind,
  CERTIFICATION_TYPES,
  type CertificationType,
} from '@equipment-ledger/shared';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'assets', versionKey: false })
export class AssetRecord {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, enum: ASSET_KINDS })
  kind: AssetKind;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: String, enum: [...CERTIFICATION_TYPES, null], default: null })
  requiredCertification: CertificationType | null;

  @Prop({ type: Date, required: true })
  registeredAt: Date;

  @Prop({ type: Number, required: true, default: 0 })
  version: number;
}

export type AssetDocument = HydratedDocument<AssetRecord>;

export const AssetSchema = SchemaFactory.createForClass(AssetRecord);
