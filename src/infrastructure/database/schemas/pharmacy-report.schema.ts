import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type PharmacyReportDocument = PharmacyReport & Document;

export enum ReportSource {
  COMMUNITY = 'COMMUNITY',
  VERIFIED_COMMUNITY = 'VERIFIED_COMMUNITY',
  OFFICIAL = 'OFFICIAL',
}

@Schema({ timestamps: true })
export class PharmacyReport {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Pharmacy', required: true })
  pharmacyId!: string;

  @Prop({ required: true })
  deviceId!: string;

  @Prop({ required: true })
  shiftKey!: string;

  @Prop()
  sourceId?: string;

  @Prop({ type: String })
  userId?: string;

  @Prop({ required: true })
  distanceMeters!: number;

  @Prop({ required: true })
  isOnDuty!: boolean;

  @Prop({ default: 0 })
  confidence!: number;

  @Prop({ type: String, enum: ReportSource, default: ReportSource.COMMUNITY })
  source!: ReportSource;

  @Prop()
  imageUrl?: string;

  @Prop({ default: false })
  isSilentlyDiscarded!: boolean;

  @Prop({ required: true })
  expiresAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PharmacyReportSchema = SchemaFactory.createForClass(PharmacyReport);

// Each device has one mutable report per voluntary pharmacy shift.
PharmacyReportSchema.index(
  { pharmacyId: 1, shiftKey: 1, deviceId: 1 },
  { unique: true, partialFilterExpression: { shiftKey: { $type: 'string' } } },
);

// Reports stop affecting results at the end of the 08:00-08:00 duty window
// and MongoDB removes them shortly afterwards.
PharmacyReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
