import { Test, TestingModule } from '@nestjs/testing';
import { ColfarjuyScraperService } from './colfarjuy-scraper.service';
import axios from 'axios';
import * as pdf from 'pdf-parse';
import { chromium } from 'playwright-core';
import { Logger } from '@nestjs/common';

jest.mock('axios');
jest.mock('pdf-parse');
jest.mock('playwright-core', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedChromium = chromium as jest.Mocked<any>;

describe('ColfarjuyScraperService', () => {
  let service: ColfarjuyScraperService;

  const mockPage = {
    goto: jest.fn(),
    content: jest.fn(),
    waitForTimeout: jest.fn(),
  };

  const mockContext = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    addInitScript: jest.fn(),
  };

  const mockBrowser = {
    newContext: jest.fn().mockResolvedValue(mockContext),
    close: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColfarjuyScraperService,
      ],
    }).compile();

    service = module.get<ColfarjuyScraperService>(ColfarjuyScraperService);
    
    // Silence logger during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    mockedChromium.launch.mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scrapeRegion', () => {
    it('should extract text from Capital HTML using Playwright', async () => {
      const html = '<div class="item-page"><p>Farmacia de Turno: Belgrano</p></div>';
      mockPage.content.mockResolvedValue(html);

      const result = await service.scrapeRegion('Capital');

      expect(mockedChromium.launch).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith(
        expect.stringContaining('novedades/1093'),
        expect.objectContaining({ waitUntil: 'domcontentloaded' })
      );
      expect(result).toHaveLength(1);
      expect(result[0].text).toContain('Farmacia de Turno: Belgrano');
      expect(result[0].inferredCity).toBe('San Salvador de Jujuy');
    });

    it('should handle PDF links in Interior correctly', async () => {
      const html = '<a href="/turnos-palpala.pdf">Turnos Palpalá</a>';
      mockPage.content.mockResolvedValue(html);
      mockedAxios.get.mockResolvedValueOnce({ data: Buffer.from('pdf content'), status: 200 });
      
      const pdfParser = (pdf as any).default || pdf;
      (pdfParser as jest.Mock).mockResolvedValue({ text: 'text from palpala pdf' });

      const result = await service.scrapeRegion('Interior');

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('text from palpala pdf');
      expect(result[0].inferredCity).toBe('Palpalá');
    });

    it('should infer Libertador correctly from link text', async () => {
      const html = '<a href="/turnos.pdf">Turnos Ledesma - Libertador</a>';
      mockPage.content.mockResolvedValue(html);
      mockedAxios.get.mockResolvedValueOnce({ data: Buffer.from('pdf content'), status: 200 });
      
      const pdfParser = (pdf as any).default || pdf;
      (pdfParser as jest.Mock).mockResolvedValue({ text: 'text' });

      const result = await service.scrapeRegion('Interior');
      expect(result[0].inferredCity).toBe('Libertador Gral. San Martín');
    });

    it('should handle errors and close browser', async () => {
      mockedChromium.launch.mockRejectedValue(new Error('Browser failed'));
      await expect(service.scrapeRegion('Capital')).rejects.toThrow('Browser failed');
      // finally block should not be called if launch fails and browser is undefined
    });
  });
});
