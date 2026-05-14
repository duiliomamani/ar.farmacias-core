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
    scrapeRegion: jest.fn().mockResolvedValue('raw text data'),
  };

  const mockAiNormalizerService = {
    normalizeColfarjuyText: jest.fn().mockResolvedValue([
      { 
        name: 'Farmacia Test', 
        address: 'Calle 123', 
        city: 'Perico', 
        isOnDuty: true, 
        dutyFrom: '2026-01-01T08:00:00Z',
        dutyUntil: '2026-01-02T08:00:00Z' 
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
    expect(aiNormalizerService.normalizeColfarjuyText).toHaveBeenCalledTimes(4); // 2 regions * 2 weeks
    expect(geoRefService.geocodeAddress).toHaveBeenCalledTimes(4); // 4 normalizer results total
    expect(pharmacyModel.bulkWrite).toHaveBeenCalledTimes(4);
  });

  it('should map city names correctly', () => {
    expect((handler as any).mapCityName('Perico')).toBe('Ciudad de Perico');
    expect((handler as any).mapCityName('S.S. de Jujuy')).toBe('San Salvador de Jujuy');
    expect((handler as any).mapCityName(undefined)).toBe('Desconocido');
    expect((handler as any).mapCityName('Other')).toBe('Other');
  });

  it('should include isVoluntary in the update data', async () => {
    mockAiNormalizerService.normalizeColfarjuyText.mockResolvedValueOnce([
      { 
        name: 'Voluntary Farm', 
        address: 'Calle V', 
        city: 'Interior', 
        isOnDuty: true, 
        dutyFrom: '2026-01-01T17:00:00Z',
        dutyUntil: '2026-01-01T21:00:00Z', 
        isVoluntary: true 
      }
    ]);

    await (handler as any).processRegion('Interior');
    
    expect(pharmacyModel.bulkWrite).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            update: expect.objectContaining({
              $set: expect.objectContaining({
                isVoluntary: true
              })
            })
          })
        })
      ])
    );
  });

  it('should handle permanently on duty correctly', async () => {
    mockAiNormalizerService.normalizeColfarjuyText.mockResolvedValueOnce([
      { 
        name: '24/7 Farm', 
        address: 'Calle 24', 
        city: 'Capital', 
        isOnDuty: true, 
        dutyFrom: '2026-01-01T00:00:00Z',
        dutyUntil: '2026-01-01T23:59:59Z',
        isPermanentlyOnDuty: true 
      }
    ]);

    await (handler as any).processRegion('Capital');
    
    expect(pharmacyModel.bulkWrite).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            update: expect.objectContaining({
              $set: expect.objectContaining({
                isPermanentlyOnDuty: true
              })
            })
          })
        })
      ])
    );
  });
});
