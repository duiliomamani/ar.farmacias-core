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

  @Prop({ type: String })
  userId?: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  userLocation!: {
    type: 'Point';
    coordinates: [number, number];
  };

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
}

export const PharmacyReportSchema = SchemaFactory.createForClass(PharmacyReport);

// Add TTL index to automatically delete reports after 3 days
// Community reports are transient; this keeps the database within free tier limits
PharmacyReportSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 3 });
