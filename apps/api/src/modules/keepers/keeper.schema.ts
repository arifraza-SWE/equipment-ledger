import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'keepers', versionKey: false })
export class KeeperRecord {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  fullName: string;
}

export const KeeperSchema = SchemaFactory.createForClass(KeeperRecord);
