import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiNormalizerService } from './ai-normalizer.service';
import { z } from 'zod';

describe('AiNormalizerService', () => {
  let service: AiNormalizerService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('fake-api-key'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiNormalizerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AiNormalizerService>(AiNormalizerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('normalizeColfarjuyText', () => {
    it('should exist and be a function', () => {
      expect(typeof service.normalizeColfarjuyText).toBe('function');
    });

    it('should return an empty array when Gemini is not initialized (missing API key)', async () => {
      // Create a service without an API key
      const localMockConfig = { get: jest.fn().mockReturnValue(undefined) };
      const localModule: TestingModule = await Test.createTestingModule({
        providers: [
          AiNormalizerService,
          { provide: ConfigService, useValue: localMockConfig },
        ],
      }).compile();
      const localService = localModule.get<AiNormalizerService>(AiNormalizerService);
      
      const result = await localService.normalizeColfarjuyText('raw text', 'Capital');
      expect(result).toEqual([]);
    });

    it('should correctly include date range in prompt (verified via spy)', async () => {
      const callGeminiSpy = jest.spyOn(service as any, 'callGemini').mockResolvedValue([]);
      
      const dateRange = { start: '2026-06-01', end: '2026-06-07' };
      await service.normalizeColfarjuyText('raw text', 'Capital', dateRange);

      expect(callGeminiSpy).toHaveBeenCalledWith(
        expect.stringContaining('EXTRACT ONLY for the date range: from 2026-06-01 to 2026-06-07 inclusive.'),
        expect.anything()
      );
    });

    it('should include isVoluntary in the schema for both Capital and Interior', async () => {
      const callGeminiSpy = jest.spyOn(service as any, 'callGemini').mockResolvedValue([]);
      
      // Test for Capital
      await service.normalizeColfarjuyText('raw text', 'Capital');
      const capitalSchema = callGeminiSpy.mock.calls[0][1];
      const capitalItemSchema = (capitalSchema as any).element;
      expect(capitalItemSchema.shape).toHaveProperty('isVoluntary');

      // Test for Interior
      await service.normalizeColfarjuyText('raw text', 'Interior');
      const interiorSchema = callGeminiSpy.mock.calls[1][1];
      const interiorItemSchema = (interiorSchema as any).element;
      expect(interiorItemSchema.shape).toHaveProperty('isVoluntary');
    });
  });

  describe('callGemini (Private Logic)', () => {
    let mockGenerateContent: jest.Mock;

    beforeEach(() => {
      mockGenerateContent = jest.fn();
      (service as any).genAI = {
        models: {
          generateContent: mockGenerateContent,
        },
      };
    });

    it('should handle empty result text from Gemini', async () => {
      mockGenerateContent.mockResolvedValue({});
      const result = await (service as any).callGemini('prompt', z.array(z.any()));
      expect(result).toEqual([]);
    });

    it('should handle JSON parse errors from Gemini', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'invalid-json' });
      const result = await (service as any).callGemini('prompt', z.array(z.any()));
      expect(result).toEqual([]);
    });

    it('should handle double-encoded JSON string', async () => {
      const validArray = [{ name: 'Test' }];
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(JSON.stringify(validArray)) });
      
      const result = await (service as any).callGemini('prompt', z.array(z.any()));
      
      expect(result).toEqual(validArray);
    });

    it('should handle general errors and log them', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'));
      const result = await (service as any).callGemini('prompt', z.array(z.any()));
      expect(result).toEqual([]);
    });
  });
});
