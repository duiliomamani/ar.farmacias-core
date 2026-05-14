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
      this.logger.log(`[Scraper] Starting scrape for region [${region}] at URL: ${url}`);
      const { data: html } = await axios.get(url);
      this.logger.log(`[Scraper] Downloaded HTML content successfully. Size: ${html.length} bytes.`);
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
        this.logger.log(`[Scraper] Found ${pdfLinks.length} PDF sources. Preparing to parse them...`);
        for (const pdfUrl of pdfLinks) {
          const pdfContent = await this.downloadAndParsePdf(pdfUrl);
          rawText += pdfContent + '\n';
        }
      } else {
        // Scenario A: Extract text from standard containers
        this.logger.log('[Scraper] No PDFs found. Attempting to extract text from raw HTML content...');
        const contentContainer = $('.item-page, .article-content, #main-content');
        rawText = contentContainer.find('p, table, div').text();
      }

      if (!rawText.trim()) {
        this.logger.warn(`[Scraper] ❌ Warning: No text content found at ${url}`);
        return '';
      }

      this.logger.log(`[Scraper] ✅ Successfully extracted ${rawText.length} characters of raw text for ${region}.`);
      return rawText;

    } catch (error: any) {
      this.logger.error(`Error scraping article ${url}: ${error.message}`, error.stack);
      throw error;
    }
  }


  private async downloadAndParsePdf(pdfUrl: string): Promise<string> {
    try {
      this.logger.log(`[PDF Parser] Downloading PDF from: ${pdfUrl}`);
      const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      this.logger.log(`[PDF Parser] PDF downloaded. Size: ${response.data.byteLength} bytes. Parsing...`);
      // Use the default export from pdf-parse or cast it as any to call it
      const pdfParser = (pdf as any).default || pdf;
      const data = await pdfParser(Buffer.from(response.data));
      this.logger.log(`[PDF Parser] ✅ PDF parsed successfully. Extracted ${data.text.length} characters.`);
      return data.text;
    } catch (error: any) {
      this.logger.error(`Failed to parse PDF ${pdfUrl}: ${error.message}`);
      return '';
    }
  }
}
