import { Injectable, NotFoundException } from '@nestjs/common';
import { IScraperStrategy } from '../../domain/interfaces/pharmacy-system.interface';
import { PdfScraperStrategy } from './pdf-scraper.strategy';
import { SocialMediaScraperStrategy } from './social-media-scraper.strategy';

@Injectable()
export class ScraperFactory {
  private strategies: IScraperStrategy[];

  constructor() {
    this.strategies = [
      new PdfScraperStrategy(),
      new SocialMediaScraperStrategy(),
    ];
  }

  getStrategy(source: string): IScraperStrategy {
    const strategy = this.strategies.find((s) => s.supports(source));
    if (!strategy) {
      throw new NotFoundException(`No scraper strategy found for source: ${source}`);
    }
    return strategy;
  }
}
