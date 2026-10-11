import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FeedbackDocument = Feedback & Document;

@Schema({ timestamps: true })
export class Feedback {
  @Prop({ required: true, enum: ['problem', 'suggestion', 'comment'] })
  topic!: string;

  @Prop({ required: true, maxlength: 2000 })
  message!: string;

  @Prop({ maxlength: 200 })
  page?: string;

  @Prop({ maxlength: 80 })
  pharmacyId?: string;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
