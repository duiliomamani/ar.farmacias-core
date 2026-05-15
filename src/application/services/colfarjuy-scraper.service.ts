import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as pdf from 'pdf-parse';
import { chromium, Browser } from 'playwright-core';

export interface ScrapedContent {
  text?: string;
  pdfBuffer?: Buffer;
  source?: string;
  inferredCity?: string;
}

@Injectable()
export class ColfarjuyScraperService {
  private readonly logger = new Logger(ColfarjuyScraperService.name);

  private readonly URL_CAPITAL = 'https://www.colfarjuy.org.ar/novedades/1093-san-salvador-de-jujuy-recordatorio-del-turnero-de-farmacias-correspondiente-al-primer-semestre-2026';
  private readonly URL_INTERIOR = 'https://www.colfarjuy.org.ar/novedades/1094-interior-de-jujuy-recordatorio-del-turnero-de-farmacias-correspondiente-al-primer-semestre-2026';

  private readonly COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Connection': 'keep-alive',
  };

  constructor() { }

  /**
   * Orchestrates scraping based on region
   */
  async scrapeRegion(region: 'Capital' | 'Interior'): Promise<ScrapedContent[]> {
    const url = region === 'Capital' ? this.URL_CAPITAL : this.URL_INTERIOR;
    let browser: Browser | undefined;

    try {
      this.logger.log(`[Scraper] Starting Playwright scrape for region [${region}]`);

      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });

      const context = await browser.newContext({
        userAgent: this.COMMON_HEADERS['User-Agent'],
        viewport: { width: 1280, height: 720 },
      });

      // Evasion: Remove navigator.webdriver
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const page = await context.newPage();
      this.logger.log(`[Scraper] Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait for Cloudflare/scripts
      await page.waitForTimeout(10000);

      const html = await page.content();
      const $ = cheerio.load(html);

      if (region === 'Capital') {
        return await this.scrapeCapitalContent($);
      } else {
        return await this.scrapeInteriorContent($);
      }

    } catch (error: any) {
      this.logger.error(`[Scraper] Error scraping ${region} at ${url}: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
        this.logger.log(`[Scraper] Browser closed.`);
      }
    }
  }

  /**
   * Specialized scraping for Capital region (Mainly grid/text)
   */
  private async scrapeCapitalContent($: cheerio.CheerioAPI): Promise<ScrapedContent[]> {
    this.logger.log('[Scraper] Extracting Capital content...');
    const results: ScrapedContent[] = [];

    // Capital usually has text directly or a main PDF
    const contentContainer = $('.item-page, .article-content, #main-content');
    const rawText = contentContainer.text().trim();

    // Check for PDFs in Capital just in case
    const pdfLinks = this.extractPdfLinks($);
    if (pdfLinks.length > 0) {
      for (const pdfItem of pdfLinks) {
        const { buffer, text } = await this.downloadAndParsePdf(pdfItem.url);
        if (buffer) {
          results.push({ 
            pdfBuffer: buffer, 
            text: text || '', 
            source: pdfItem.url, 
            inferredCity: 'San Salvador de Jujuy' 
          });
        }
      }
    }

    if (rawText && results.length === 0) {
      results.push({ text: rawText, inferredCity: 'San Salvador de Jujuy' });
    }

    return results;
  }

  /**
   * Specialized scraping for Interior region (Multiple PDFs by city)
   */
  private async scrapeInteriorContent($: cheerio.CheerioAPI): Promise<ScrapedContent[]> {
    this.logger.log('[Scraper] Extracting Interior content (multi-PDF)...');
    const results: ScrapedContent[] = [];
    const pdfLinks = this.extractPdfLinks($);

    for (const pdfItem of pdfLinks) {
      const { buffer, text } = await this.downloadAndParsePdf(pdfItem.url);
      if (buffer) {
        const inferredCity = this.inferCityFromText(pdfItem.linkText);
        results.push({
          pdfBuffer: buffer,
          text: text || '',
          source: pdfItem.url,
          inferredCity
        });
      }
    }

    return results;
  }

  /**
   * Helper to extract all PDF and Google Drive links
   */
  private extractPdfLinks($: cheerio.CheerioAPI): { url: string, linkText: string }[] {
    const links: { url: string, linkText: string }[] = [];

    // Standard PDF links
    $('a[href$=".pdf"]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href) {
        links.push({
          url: href.startsWith('http') ? href : `https://www.colfarjuy.org.ar${href}`,
          linkText: text
        });
      }
    });

    // Google Drive Iframes
    $('iframe[src*="drive.google.com"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        const match = src.match(/\/file\/d\/(.+?)\/preview/);
        if (match && match[1]) {
          links.push({
            url: `https://drive.google.com/uc?export=download&id=${match[1]}`,
            linkText: 'Google Drive PDF'
          });
        }
      }
    });

    return links;
  }

  private inferCityFromText(text: string): string | undefined {
    if (!text) return undefined;
    const cities = ['Palpala', 'Palpalá', 'Perico', 'El Carmen', 'Monterrico', 'San Pedro', 'La Esperanza', 'Ledesma', 'Libertador General San Martín', 'Fraile Pintado', 'Humahuaca', 'Tilcara', 'La Quiaca', 'Abra Pampa'];
    const found = cities.find(city => text.toLowerCase().includes(city.toLowerCase()));

    if (found?.toLowerCase().includes('palpala')) return 'Palpalá';
    if (found?.toLowerCase().includes('lgsm') || found?.toLowerCase().includes('ledesma') || found?.toLowerCase().includes('libertador')) return 'Libertador Gral. San Martín';


    return found;
  }

  private async downloadAndParsePdf(pdfUrl: string): Promise<{ buffer: Buffer | null, text: string }> {
    try {
      this.logger.log(`[PDF Parser] Downloading PDF: ${pdfUrl}`);
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        headers: this.COMMON_HEADERS
      });

      const buffer = Buffer.from(response.data);
      let text = '';
      
      try {
        const pdfParser = (pdf as any).default || pdf;
        const data = await pdfParser(buffer);
        text = data.text;
      } catch (parseError: any) {
        this.logger.warn(`[PDF Parser] Could not parse text from PDF: ${parseError.message}`);
      }

      return { buffer, text };
    } catch (error: any) {
      this.logger.error(`[PDF Parser] Failed to download or parse ${pdfUrl}: ${error.message}`);
      return { buffer: null, text: '' };
    }
  }
}
