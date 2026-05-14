import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiNormalizerService } from './ai-normalizer.service';

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

    it('should include isVoluntary in the schema for Interior but not for Capital', async () => {
      const callGeminiSpy = jest.spyOn(service as any, 'callGemini').mockResolvedValue([]);
      
      // Test for Capital
      await service.normalizeColfarjuyText('raw text', 'Capital');
      const capitalSchema = callGeminiSpy.mock.calls[0][1];
      const capitalItemSchema = (capitalSchema as any).element;
      expect(capitalItemSchema.shape).not.toHaveProperty('isVoluntary');

      // Test for Interior
      await service.normalizeColfarjuyText('raw text', 'Interior');
      const interiorSchema = callGeminiSpy.mock.calls[1][1];
      const interiorItemSchema = (interiorSchema as any).element;
      expect(interiorItemSchema.shape).toHaveProperty('isVoluntary');
    });
  });
});
