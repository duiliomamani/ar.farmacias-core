import { Test, TestingModule } from '@nestjs/testing';
import { ColfarjuyScraperService } from './colfarjuy-scraper.service';
import axios from 'axios';
import * as pdf from 'pdf-parse';

jest.mock('axios');
jest.mock('pdf-parse');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ColfarjuyScraperService', () => {
  let service: ColfarjuyScraperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColfarjuyScraperService,
      ],
    }).compile();

    service = module.get<ColfarjuyScraperService>(ColfarjuyScraperService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scrapeRegion', () => {
    it('should extract text from HTML', async () => {
      const html = '<div class="item-page"><p>Farmacia de Turno: Belgrano</p></div>';
      mockedAxios.get.mockResolvedValue({ data: html });

      const result = await service.scrapeRegion('Capital');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.colfarjuy.org.ar/novedades/1093-san-salvador-de-jujuy-recordatorio-del-turnero-de-farmacias-correspondiente-al-primer-semestre-2026',
        expect.objectContaining({ headers: expect.any(Object) })
      );
      expect(result).toContain('Farmacia de Turno: Belgrano');
    });

    it('should handle PDF links correctly', async () => {
      const html = '<a href="/file.pdf">Ver PDF</a>';
      mockedAxios.get.mockResolvedValueOnce({ data: html });
      mockedAxios.get.mockResolvedValueOnce({ data: Buffer.from('pdf content'), status: 200 });
      
      const pdfParser = (pdf as any).default || pdf;
      (pdfParser as jest.Mock).mockResolvedValue({ text: 'text from pdf' });

      const result = await service.scrapeRegion('Interior');

      expect(result).toContain('text from pdf');
    });

    it('should handle PDF download error', async () => {
        const html = '<a href="/file.pdf">Ver PDF</a>';
        mockedAxios.get.mockResolvedValueOnce({ data: html });
        mockedAxios.get.mockRejectedValueOnce(new Error('Download failed'));
  
        const result = await service.scrapeRegion('Interior');
        expect(result).toBe('');
      });

    it('should handle empty content', async () => {
      mockedAxios.get.mockResolvedValue({ data: '<html></html>' });
      const result = await service.scrapeRegion('Capital');
      expect(result).toBe('');
    });

    it('should handle errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));
      await expect(service.scrapeRegion('Capital')).rejects.toThrow('Network error');
    });
  });
});
