import { ScraperFactory } from './scraper.factory';
import { PdfScraperStrategy } from './pdf-scraper.strategy';
import { SocialMediaScraperStrategy } from './social-media-scraper.strategy';
import { NotFoundException } from '@nestjs/common';

describe('ScraperFactory', () => {
  let factory: ScraperFactory;

  beforeEach(() => {
    factory = new ScraperFactory();
  });

  it('should return PdfScraperStrategy for .pdf files', () => {
    const strategy = factory.getStrategy('test.pdf');
    expect(strategy).toBeInstanceOf(PdfScraperStrategy);
  });

  it('should return SocialMediaScraperStrategy for facebook URLs', () => {
    const strategy = factory.getStrategy('https://facebook.com/test');
    expect(strategy).toBeInstanceOf(SocialMediaScraperStrategy);
  });

  it('should throw NotFoundException for unsupported sources', () => {
    expect(() => factory.getStrategy('unsupported-source')).toThrow(NotFoundException);
  });
});
