import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PharmacyDocument = Pharmacy & Document;

@Schema({ timestamps: true, strict: false })
export class Pharmacy {
  @Prop({ required: true })
  name!: string;

  @Prop()
  city?: string;

  @Prop()
  originalAddress!: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number],
    },
  })
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop({
    type: {
      provinciaId: String,
      municipioId: String,
      localidadId: String,
      streetName: String,
      streetNumber: String,
    },
  })
  georef?: {
    provinciaId: string;
    municipioId: string;
    localidadId: string;
    streetName?: string;
    streetNumber?: string;
  };

  @Prop({ required: true, default: 'MANUAL' })
  source_type!: string;

  @Prop({ default: false })
  isOnDuty!: boolean;

  @Prop()
  dutyFrom?: Date;

  @Prop()
  dutyUntil?: Date;

  @Prop()
  openingHours?: string;

  @Prop({ default: false })
  isPermanentlyOnDuty?: boolean;

  @Prop({ default: false })
  isVoluntary?: boolean;

  @Prop({ type: Object })
  raw_data?: any;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PharmacySchema = SchemaFactory.createForClass(Pharmacy);

// Add sparse 2dsphere index for geospatial queries
PharmacySchema.index({ location: '2dsphere' }, { sparse: true });

// Add TTL index to automatically delete old pharmacy shifts 15 days after duty expires
// This keeps the database lean and stays within the free tier limits
PharmacySchema.index({ dutyUntil: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 15 });
