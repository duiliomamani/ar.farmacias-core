import { IScraperStrategy } from '../../domain/interfaces/pharmacy-system.interface';
import * as pdf from 'pdf-parse';
import axios from 'axios';

export class PdfScraperStrategy implements IScraperStrategy {
  supports(source: string): boolean {
    return source.toLowerCase().endsWith('.pdf');
  }

  async scrape(source: string): Promise<string> {
    const response = await axios.get(source, { responseType: 'arraybuffer' });
    const pdfParser = (pdf as any).default || pdf;
    const data = await pdfParser(response.data);
    return data.text;
  }
}
