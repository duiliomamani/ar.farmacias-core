import { PdfScraperStrategy } from './pdf-scraper.strategy';
import axios from 'axios';
import * as pdf from 'pdf-parse';

jest.mock('axios');
jest.mock('pdf-parse');

describe('PdfScraperStrategy', () => {
  let strategy: PdfScraperStrategy;

  beforeEach(() => {
    strategy = new PdfScraperStrategy();
  });

  describe('supports', () => {
    it('should return true for .pdf files', () => {
      expect(strategy.supports('test.pdf')).toBe(true);
      expect(strategy.supports('TEST.PDF')).toBe(true);
    });

    it('should return false for other files', () => {
      expect(strategy.supports('test.txt')).toBe(false);
    });
  });

  describe('scrape', () => {
    it('should download and parse pdf', async () => {
      const source = 'https://test.com/file.pdf';
      const mockBuffer = Buffer.from('mock data');
      (axios.get as jest.Mock).mockResolvedValue({ data: mockBuffer });
      (pdf as any).mockResolvedValue({ text: 'parsed text' });

      const result = await strategy.scrape(source);

      expect(axios.get).toHaveBeenCalledWith(source, { responseType: 'arraybuffer' });
      expect(result).toBe('parsed text');
    });
  });
});
