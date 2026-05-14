import { SocialMediaScraperStrategy } from './social-media-scraper.strategy';

describe('SocialMediaScraperStrategy', () => {
  let strategy: SocialMediaScraperStrategy;

  beforeEach(() => {
    strategy = new SocialMediaScraperStrategy();
  });

  describe('supports', () => {
    it('should return true for facebook/instagram URLs', () => {
      expect(strategy.supports('https://facebook.com/test')).toBe(true);
      expect(strategy.supports('https://instagram.com/test')).toBe(true);
    });

    it('should return false for other URLs', () => {
      expect(strategy.supports('https://google.com')).toBe(false);
    });
  });

  describe('scrape', () => {
    it('should throw Error (not implemented)', async () => {
      await expect(strategy.scrape('https://facebook.com/test')).rejects.toThrow(
        'Scraping from social media (https://facebook.com/test) is not yet implemented.',
      );
    });
  });
});
