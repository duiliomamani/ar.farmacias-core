import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { COLFARJUY_SYSTEM_PROMPT, COLFARJUY_INTERIOR_PROMPT } from './prompts';

export interface NormalizedPharmacy {
  name: string;
  address: string;
  city?: string;
  isOnDuty: boolean;
  dutyFrom: string; // ISO format
  dutyUntil: string; // ISO format
  openingHours?: string; // Human readable string
  isVoluntary?: boolean;
  isPermanentlyOnDuty?: boolean;
}

@Injectable()
export class AiNormalizerService {
  private readonly logger = new Logger(AiNormalizerService.name);
  private genAI?: GoogleGenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey: apiKey });
    } else {
      this.logger.warn('GEMINI_API_KEY is missing. AI normalization will be disabled.');
    }
  }


  async normalizeColfarjuyText(
    rawText: string,
    region: 'Capital' | 'Interior',
    dateRange?: { start: string, end: string },
    inferredCity?: string
  ): Promise<NormalizedPharmacy[]> {
    const today = new Date().toISOString().split('T')[0];
    const rangeInstruction = dateRange
      ? `EXTRACT ONLY for the date range: from ${dateRange.start} to ${dateRange.end} inclusive.`
      : `EXTRACT ALL pharmacies mentioned in the text for the current and future dates.`;

    const cityContext = inferredCity
      ? `CITY CONTEXT: The provided text is specifically for the city of "${inferredCity}". Set the "city" field for all extracted pharmacies to this value unless the text explicitly states otherwise.`
      : '';

    const basePrompt = region === 'Capital' ? COLFARJUY_SYSTEM_PROMPT : COLFARJUY_INTERIOR_PROMPT;

    const fullPrompt = `${basePrompt}

    ADDITIONAL DYNAMIC CONTEXT:
    Today's date is ${today}.
    ${rangeInstruction}
    ${cityContext}
    
    Text: "${rawText}"`;

    this.logger.log(`Normalizing Colfarjuy ${region} text via Gemini (Range: ${dateRange?.start || 'ALL'} - ${dateRange?.end || 'ALL'})...`);

    const schemaFields: any = {
      name: z.string().describe("The name of the pharmacy."),
      address: z.string().optional().describe("Optional address of the pharmacy."),
      city: z.string().optional().describe("Optional city of the pharmacy."),
      isOnDuty: z.boolean().describe("Whether the pharmacy is on duty."),
      dutyFrom: z.string().optional().describe("Optional ISO 8601 date and time when the duty starts."),
      dutyUntil: z.string().optional().describe("Optional ISO 8601 date and time when the duty ends."),
      openingHours: z.string().optional().describe("Human readable opening hours (e.g. '08:00 a 08:00 del día siguiente')."),
      isPermanentlyOnDuty: z.boolean().optional().describe("Whether the pharmacy is permanently on duty (24hs)."),
      isVoluntary: z.boolean().optional().describe("Whether the shift is a voluntary shift (e.g. Saturday 17:00 to 21:00, Listado B/C)."),
    };

    const pharmacyItemSchema = z.object(schemaFields);

    const pharmacySchema = z.array(pharmacyItemSchema);

    return this.callGemini(fullPrompt, pharmacySchema);
  }


  private async callGemini(prompt: string, schema: z.ZodSchema<any>): Promise<any[]> {
    if (!this.genAI) {
      this.logger.error('Gemini API Key is missing. Returning empty array.');
      return [];
    }

    try {
      let jsonSchema = zodToJsonSchema(schema as any);

      const result = await this.genAI.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema as any,
          temperature: 0.1,
        }
      });

      const resultText = (result as any).text || '';

      if (!resultText) {
        this.logger.error('No text returned from Gemini API');
        return [];
      }

      this.logger.log(`Raw response from Gemini: ${resultText}`);

      let json: any;
      try {
        json = JSON.parse(resultText);
      } catch (e: any) {
        this.logger.error(`Failed to parse JSON response from Gemini: ${e.message}`);
        return [];
      }

      if (typeof json === 'string') {
        this.logger.warn('Gemini returned a double-encoded JSON string. Parsing again...');
        try {
          json = JSON.parse(json);
        } catch (e: any) {
          this.logger.error(`Failed to parse double-encoded JSON: ${e.message}`);
          return [];
        }
      }

      this.logger.log('Parsed JSON:', json);
      return schema.parse(json);
    } catch (error: any) {
      this.logger.error(`Error calling Gemini API: ${error.message}`);
      return [];
    }
  }
}
