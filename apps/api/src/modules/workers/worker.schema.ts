import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { CERTIFICATION_TYPES, type CertificationType } from '@equipment-ledger/shared';
import type { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class CertificationRecord {
  @Prop({ type: String, required: true, enum: CERTIFICATION_TYPES })
  type: CertificationType;

  @Prop({ type: Date, required: true })
  issuedAt: Date;

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

const CertificationSchema = SchemaFactory.createForClass(CertificationRecord);

@Schema({ collection: 'workers', versionKey: false })
export class WorkerRecord {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  fullName: string;

  @Prop({ type: String, required: true })
  trade: string;

  @Prop({ type: [CertificationSchema], default: [] })
  certifications: CertificationRecord[];

  @Prop({ type: Date, required: true })
  registeredAt: Date;
}

export type WorkerDocument = HydratedDocument<WorkerRecord>;

export const WorkerSchema = SchemaFactory.createForClass(WorkerRecord);
