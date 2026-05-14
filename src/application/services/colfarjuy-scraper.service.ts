import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as pdf from 'pdf-parse';
import { chromium } from 'playwright-core';

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
   * Scrapes a specific region's schedule using Playwright to bypass Cloudflare
   */
  async scrapeRegion(region: 'Capital' | 'Interior'): Promise<string> {
    const url = region === 'Capital' ? this.URL_CAPITAL : this.URL_INTERIOR;
    let browser;
    try {
      this.logger.log(`[Scraper] Starting Playwright scrape for region [${region}]`);
      
      browser = await chromium.launch({ 
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      });

      const context = await browser.newContext({
        userAgent: this.COMMON_HEADERS['User-Agent'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      });

      // Manual Evasion: Remove navigator.webdriver
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      
      const page = await context.newPage();
      
      this.logger.log(`[Scraper] Navigating to: ${url}`);
      
      // Navigate and wait for network to be idle (Cloudflare challenge usually finishes by then)
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      
      // Extra wait just in case Cloudflare is still thinking
      await page.waitForTimeout(5000);

      const html = await page.content();
      const status = 200; // Playwright doesn't easily expose the main frame status if it redirects through CF

      this.logger.log(`[Scraper] Page content captured. Size: ${html.length} bytes.`);

      if (html.includes('Just a moment...') || html.includes('cloudflare')) {
        this.logger.warn(`[Scraper] ⚠️ Detected Cloudflare challenge in captured content. Bypass might have failed.`);
      }

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
    } finally {
      if (browser) {
        await browser.close();
        this.logger.log(`[Scraper] Browser closed.`);
      }
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
