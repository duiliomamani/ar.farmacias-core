import { IScraperStrategy } from '../../domain/interfaces/pharmacy-system.interface';

export class SocialMediaScraperStrategy implements IScraperStrategy {
  supports(source: string): boolean {
    // Basic implementation: check for common social media domains or keywords
    return source.includes('facebook.com') || source.includes('instagram.com');
  }

  async scrape(source: string): Promise<string> {
    // Placeholder for future implementation (OCR, Puppeteer, etc.)
    throw new Error(`Scraping from social media (${source}) is not yet implemented.`);
  }
}
