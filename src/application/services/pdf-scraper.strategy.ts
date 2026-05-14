import { IScraperStrategy } from '../../domain/interfaces/pharmacy-system.interface';
import * as pdf from 'pdf-parse';
import axios from 'axios';

export class PdfScraperStrategy implements IScraperStrategy {
  private readonly COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };

  supports(source: string): boolean {
    return source.toLowerCase().endsWith('.pdf');
  }

  async scrape(source: string): Promise<string> {
    const response = await axios.get(source, { 
      responseType: 'arraybuffer',
      headers: this.COMMON_HEADERS
    });
    const pdfParser = (pdf as any).default || pdf;
    const data = await pdfParser(response.data);
    return data.text;
  }
}
