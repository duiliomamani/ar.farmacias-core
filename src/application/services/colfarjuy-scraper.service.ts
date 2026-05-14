import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as pdf from 'pdf-parse';

@Injectable()
export class ColfarjuyScraperService {
  private readonly logger = new Logger(ColfarjuyScraperService.name);
  
  private readonly URL_CAPITAL = 'https://www.colfarjuy.org.ar/novedades/1093-san-salvador-de-jujuy-recordatorio-del-turnero-de-farmacias-correspondiente-al-primer-semestre-2026';
  private readonly URL_INTERIOR = 'https://www.colfarjuy.org.ar/novedades/1094-interior-de-jujuy-recordatorio-del-turnero-de-farmacias-correspondiente-al-primer-semestre-2026';

  constructor() { }

  /**
   * Scrapes a specific region's schedule
   */
  async scrapeRegion(region: 'Capital' | 'Interior'): Promise<string> {
    const url = region === 'Capital' ? this.URL_CAPITAL : this.URL_INTERIOR;
    try {
      this.logger.log(`Starting scrape for ${region} at ${url}`);
      const { data: html } = await axios.get(url);
      const $ = cheerio.load(html);

      // Scenario B: Look for direct PDF links or Google Drive iframes
      const pdfLinks: string[] = [];

      // Direct links
      $('a[href$=".pdf"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          pdfLinks.push(href.startsWith('http') ? href : `https://www.colfarjuy.org.ar${href}`);
        }
      });

      // Google Drive Iframes
      $('iframe[src*="drive.google.com"]').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
          // Extract ID from https://drive.google.com/file/d/FILE_ID/preview
          const match = src.match(/\/file\/d\/(.+?)\/preview/);
          if (match && match[1]) {
            pdfLinks.push(`https://drive.google.com/uc?export=download&id=${match[1]}`);
          }
        }
      });

      let rawText = '';

      if (pdfLinks.length > 0) {
        this.logger.log(`Found ${pdfLinks.length} PDF sources. Parsing...`);
        for (const pdfUrl of pdfLinks) {
          const pdfContent = await this.downloadAndParsePdf(pdfUrl);
          rawText += pdfContent + '\n';
        }
      } else {
        // Scenario A: Extract text from standard containers
        this.logger.log('No PDFs found. Extracting text from HTML content.');
        const contentContainer = $('.item-page, .article-content, #main-content');
        rawText = contentContainer.find('p, table, div').text();
      }

      if (!rawText.trim()) {
        this.logger.warn(`No text content found at ${url}`);
        return '';
      }

      return rawText;

    } catch (error: any) {
      this.logger.error(`Error scraping article ${url}: ${error.message}`, error.stack);
      throw error;
    }
  }


  private async downloadAndParsePdf(pdfUrl: string): Promise<string> {
    try {
      this.logger.log(`Downloading PDF: ${pdfUrl}`);
      const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      // Use the default export from pdf-parse or cast it as any to call it
      const pdfParser = (pdf as any).default || pdf;
      const data = await pdfParser(Buffer.from(response.data));
      return data.text;
    } catch (error: any) {
      this.logger.error(`Failed to parse PDF ${pdfUrl}: ${error.message}`);
      return '';
    }
  }
}
