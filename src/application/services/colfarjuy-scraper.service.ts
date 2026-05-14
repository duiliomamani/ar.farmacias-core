import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as pdf from 'pdf-parse';

@Injectable()
export class ColfarjuyScraperService {
  private readonly logger = new Logger(ColfarjuyScraperService.name);

  private readonly URL_CAPITAL = 'https://www.colfarjuy.org.ar/novedades/1093-san-salvador-de-jujuy-recordatorio-del-turnero-de-farmacias-correspondiente-al-primer-semestre-2026';
  private readonly URL_INTERIOR = 'https://www.colfarjuy.org.ar/novedades/1094-interior-de-jujuy-recordatorio-del-turnero-de-farmacias-correspondiente-al-primer-semestre-2026';

  private readonly COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://www.colfarjuy.org.ar/',
  };

  constructor() { }

  /**
   * Scrapes a specific region's schedule
   */
  async scrapeRegion(region: 'Capital' | 'Interior'): Promise<string> {
    const url = region === 'Capital' ? this.URL_CAPITAL : this.URL_INTERIOR;
    try {
      this.logger.log(`[Scraper] Starting scrape for region [${region}]`);
      this.logger.debug(`[Scraper] Requesting URL: ${url}`);
      this.logger.debug(`[Scraper] Using Headers: ${JSON.stringify(this.COMMON_HEADERS, null, 2)}`);

      const { data: html, status } = await axios.get(url, { headers: this.COMMON_HEADERS });

      this.logger.log(`[Scraper] Received response from ${url} (Status: ${status})`);
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
      if (error.response?.status === 403) {
        const responseData = error.response.data;
        this.logger.error("Error scraping article : ", error.response.text)
        if (typeof responseData === 'string') {
          this.logger.error(`[Scraper] 403 Forbidden - Response body starts with: ${responseData.substring(0, 500)}`);
        } else {
          this.logger.error(`[Scraper] 403 Forbidden - Response body: ${JSON.stringify(responseData, null, 2)}`);
        }
      }
      this.logger.error(`Error scraping article ${url}: ${error.message}`, error.stack);
      throw error;
    }
  }


  private async downloadAndParsePdf(pdfUrl: string): Promise<string> {
    try {
      this.logger.log(`[PDF Parser] Downloading PDF from: ${pdfUrl}`);
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        headers: this.COMMON_HEADERS
      });
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
