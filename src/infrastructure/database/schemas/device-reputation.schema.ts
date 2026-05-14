import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeviceReputationDocument = DeviceReputation & Document;

@Schema({ timestamps: true })
export class DeviceReputation {
  @Prop({ required: true, unique: true })
  deviceId!: string;

  @Prop({ default: 1, min: 0, max: 10 })
  trustScore!: number;

  @Prop({ default: [] })
  associatedIps!: string[];

  @Prop({ default: 0 })
  successfulReports!: number;

  @Prop({ default: 0 })
  failedReports!: number;
}

export const DeviceReputationSchema = SchemaFactory.createForClass(DeviceReputation);
