import { Test, TestingModule } from '@nestjs/testing';
import { ColfarjuyScraperService } from './colfarjuy-scraper.service';
import axios from 'axios';
import * as pdf from 'pdf-parse';
import { chromium } from 'playwright-core';
import { addExtra } from 'playwright-extra';

jest.mock('axios');
jest.mock('pdf-parse');
jest.mock('playwright-core', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));
jest.mock('playwright-extra', () => ({
  addExtra: jest.fn().mockReturnValue({
    use: jest.fn(),
    launch: jest.fn(),
  }),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedChromium = chromium as jest.Mocked<any>;
const mockedAddExtra = addExtra as jest.MockedFunction<typeof addExtra>;
const mockedChromiumStealth = mockedAddExtra(chromium) as any;

describe('ColfarjuyScraperService', () => {
  let service: ColfarjuyScraperService;

  const mockPage = {
    goto: jest.fn(),
    content: jest.fn(),
    waitForTimeout: jest.fn(),
  };

  const mockContext = {
    newPage: jest.fn().mockResolvedValue(mockPage),
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
    mockedChromiumStealth.launch.mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scrapeRegion', () => {
    it('should extract text from HTML using Playwright', async () => {
      const html = '<div class="item-page"><p>Farmacia de Turno: Belgrano</p></div>';
      mockPage.content.mockResolvedValue(html);

      const result = await service.scrapeRegion('Capital');

      expect(mockedChromium.launch).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://www.colfarjuy.org.ar/novedades/1093-san-salvador-de-jujuy-recordatorio-del-turnero-de-farmacias-correspondiente-al-primer-semestre-2026',
        expect.anything()
      );
      expect(result).toContain('Farmacia de Turno: Belgrano');
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle PDF links correctly', async () => {
      const html = '<a href="/file.pdf">Ver PDF</a>';
      mockPage.content.mockResolvedValue(html);
      mockedAxios.get.mockResolvedValueOnce({ data: Buffer.from('pdf content'), status: 200 });
      
      const pdfParser = (pdf as any).default || pdf;
      (pdfParser as jest.Mock).mockResolvedValue({ text: 'text from pdf' });

      const result = await service.scrapeRegion('Interior');

      expect(result).toContain('text from pdf');
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle PDF download error', async () => {
        const html = '<a href="/file.pdf">Ver PDF</a>';
        mockPage.content.mockResolvedValue(html);
        mockedAxios.get.mockRejectedValueOnce(new Error('Download failed'));
  
        const result = await service.scrapeRegion('Interior');
        expect(result).toBe('');
        expect(mockBrowser.close).toHaveBeenCalled();
      });

    it('should handle empty content', async () => {
      mockPage.content.mockResolvedValue('<html></html>');
      const result = await service.scrapeRegion('Capital');
      expect(result).toBe('');
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle errors and close browser', async () => {
      mockedChromium.launch.mockRejectedValue(new Error('Browser failed'));
      await expect(service.scrapeRegion('Capital')).rejects.toThrow('Browser failed');
      // Browser didn't launch, so close shouldn't be called on it
    });
  });
});
