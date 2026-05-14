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
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => {});

    mockedChromium.launch.mockResolvedValue(mockBrowser);
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
      expect(mockContext.addInitScript).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://www.colfarjuy.org.ar/novedades/1093-san-salvador-de-jujuy-recordatorio-del-turnero-de-farmacias-correspondiente-al-primer-semestre-2026',
        expect.objectContaining({ waitUntil: 'networkidle' })
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

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.colfarjuy.org.ar/file.pdf',
        expect.anything()
      );
      expect(result).toContain('text from pdf');
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle Google Drive iframes correctly', async () => {
      const html = '<iframe src="https://drive.google.com/file/d/12345ABCDE/preview"></iframe>';
      mockPage.content.mockResolvedValue(html);
      mockedAxios.get.mockResolvedValueOnce({ data: Buffer.from('pdf content'), status: 200 });
      
      const pdfParser = (pdf as any).default || pdf;
      (pdfParser as jest.Mock).mockResolvedValue({ text: 'text from google drive' });

      const result = await service.scrapeRegion('Capital');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://drive.google.com/uc?export=download&id=12345ABCDE',
        expect.anything()
      );
      expect(result).toContain('text from google drive');
    });

    it('should detect Cloudflare challenge and log warning', async () => {
      const html = '<html><head><title>Just a moment...</title></head><body>Please enable cookies.</body></html>';
      mockPage.content.mockResolvedValue(html);
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      await service.scrapeRegion('Capital');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Detected Cloudflare challenge')
      );
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
    });

    it('should handle 403 error specifically', async () => {
      const error: any = new Error('Forbidden');
      error.response = { status: 403, data: 'Access Denied' };
      mockedChromium.launch.mockRejectedValue(error);
      
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      await expect(service.scrapeRegion('Capital')).rejects.toThrow('Forbidden');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('403 Forbidden')
      );
    });
  });
});
