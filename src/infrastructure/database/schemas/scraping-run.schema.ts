import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScrapingRunDocument = ScrapingRun & Document;

@Schema({ timestamps: true })
export class ScrapingRun {
  @Prop({ required: true })
  source!: string;

  @Prop({ required: true, enum: ['running', 'success', 'failed'] })
  status!: 'running' | 'success' | 'failed';

  @Prop({ required: true })
  startedAt!: Date;

  @Prop()
  finishedAt?: Date;

  @Prop({ default: 0 })
  recordsFound!: number;

  @Prop({ default: 0 })
  recordsValidated!: number;

  @Prop({ default: 0 })
  recordsSaved!: number;

  @Prop({ default: 0 })
  staleRemoved!: number;

  @Prop({ type: [String], default: [] })
  errorMessages!: string[];

  @Prop({ type: [String], default: [] })
  structureChanges!: string[];
}

export const ScrapingRunSchema = SchemaFactory.createForClass(ScrapingRun);
ScrapingRunSchema.index({ source: 1, startedAt: -1 });
