import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ScrapeColfarjuyHandler } from './scrape-colfarjuy.handler';
import { ColfarjuyScraperService } from '../services/colfarjuy-scraper.service';
import { AiNormalizerService } from '../services/ai-normalizer.service';
import { GeoRefService } from '../services/georef.service';
import { ScrapeColfarjuyCommand } from './scrape-colfarjuy.command';
import { Pharmacy } from '../../infrastructure/database/schemas/pharmacy.schema';

describe('ScrapeColfarjuyHandler', () => {
  let handler: ScrapeColfarjuyHandler;
  let scraperService: any;
  let aiNormalizerService: any;
  let geoRefService: any;
  let pharmacyModel: any;

  const mockScraperService = {
    scrapeRegion: jest.fn().mockResolvedValue([{ text: 'raw text data', inferredCity: 'San Salvador de Jujuy' }]),
  };

  const mockAiNormalizerService = {
    normalizeColfarjuyText: jest.fn().mockResolvedValue([
      { 
        name: 'Farmacia Test', 
        address: 'Calle 123', 
        city: 'San Salvador de Jujuy', 
        isOnDuty: true, 
        dutyFrom: new Date().toISOString(),
        dutyUntil: new Date().toISOString() 
      }
    ]),
  };

  const mockGeoRefService = {
    geocodeAddress: jest.fn().mockResolvedValue({
      lat: -24.18,
      lng: -65.30,
      provinciaId: '38',
      municipioId: '1',
      localidadId: '1',
    }),
  };

  const mockPharmacyModel = {
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
    bulkWrite: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapeColfarjuyHandler,
        { provide: ColfarjuyScraperService, useValue: mockScraperService },
        { provide: AiNormalizerService, useValue: mockAiNormalizerService },
        { provide: GeoRefService, useValue: mockGeoRefService },
        { provide: getModelToken(Pharmacy.name), useValue: mockPharmacyModel },
      ],
    }).compile();

    handler = module.get<ScrapeColfarjuyHandler>(ScrapeColfarjuyHandler);
    scraperService = module.get(ColfarjuyScraperService);
    aiNormalizerService = module.get(AiNormalizerService);
    geoRefService = module.get(GeoRefService);
    pharmacyModel = module.get(getModelToken(Pharmacy.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should orchestrate scraping, normalizing and saving', async () => {
    await handler.execute(new ScrapeColfarjuyCommand());

    expect(scraperService.scrapeRegion).toHaveBeenCalledTimes(2); // Capital and Interior
    // For each region (2) * each content block (1) * weeks (2) = 4 calls
    expect(aiNormalizerService.normalizeColfarjuyText).toHaveBeenCalledTimes(4); 
    expect(pharmacyModel.bulkWrite).toHaveBeenCalledTimes(4);
  });

  it('should pass inferredCity to AiNormalizerService', async () => {
    mockScraperService.scrapeRegion.mockResolvedValueOnce([{ text: 'interior text', inferredCity: 'Palpalá' }]);
    
    await (handler as any).processRegion('Interior');

    expect(aiNormalizerService.normalizeColfarjuyText).toHaveBeenCalledWith(
      'interior text',
      'Interior',
      expect.anything(),
      'Palpalá'
    );
  });

  it('should map city names correctly', () => {
    expect((handler as any).mapCityName('Perico')).toBe('Ciudad de Perico');
    expect((handler as any).mapCityName('S.S. de Jujuy')).toBe('San Salvador de Jujuy');
    expect((handler as any).mapCityName(undefined)).toBe('Desconocido');
  });

  describe('Edge Cases', () => {
    it('should skip processing if scraper returns no results', async () => {
      mockScraperService.scrapeRegion.mockResolvedValueOnce([]);
      await (handler as any).processRegion('Capital');
      expect(aiNormalizerService.normalizeColfarjuyText).not.toHaveBeenCalled();
    });

    it('should skip pharmacy if duty dates are missing', async () => {
      // We test saveNormalizedPharmaciesBatch directly to verify skipping logic
      const result = await (handler as any).saveNormalizedPharmaciesBatch([{ name: 'No Dates' }]);
      expect(pharmacyModel.bulkWrite).not.toHaveBeenCalled();
    });

    it('should skip pharmacy if dates are invalid', async () => {
      const result = await (handler as any).saveNormalizedPharmaciesBatch([{ 
        name: 'Invalid Date', 
        dutyFrom: 'abc', 
        dutyUntil: 'def' 
      }]);
      expect(pharmacyModel.bulkWrite).not.toHaveBeenCalled();
    });

    it('should handle geocoding failure gracefully (unset location)', async () => {
      mockAiNormalizerService.normalizeColfarjuyText.mockResolvedValueOnce([{ 
        name: 'Geo Fail', 
        address: 'X', 
        city: 'Y', 
        dutyFrom: new Date().toISOString(), 
        dutyUntil: new Date().toISOString() 
      }]);
      mockGeoRefService.geocodeAddress.mockResolvedValueOnce(null);

      await (handler as any).processRegion('Capital');

      expect(pharmacyModel.bulkWrite).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            updateOne: expect.objectContaining({
              update: expect.objectContaining({
                $unset: { location: "" }
              })
            })
          })
        ])
      );
    });

    it('should log when bulkWrite has no operations', async () => {
      mockAiNormalizerService.normalizeColfarjuyText.mockResolvedValueOnce([]);
      await (handler as any).saveNormalizedPharmaciesBatch([]);
      expect(pharmacyModel.bulkWrite).not.toHaveBeenCalled();
    });
  });
});
