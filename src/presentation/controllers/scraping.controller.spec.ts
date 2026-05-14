import { Test, TestingModule } from '@nestjs/testing';
import { ScrapingController } from './scraping.controller';
import { CommandBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { ScrapeColfarjuyCommand } from '../../application/commands/scrape-colfarjuy.command';

describe('ScrapingController', () => {
  let controller: ScrapingController;
  let commandBus: any;
  let configService: any;

  const mockCommandBus = {
    execute: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScrapingController],
      providers: [
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<ScrapingController>(ScrapingController);
    commandBus = module.get(CommandBus);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('triggerColfarjuyScraping', () => {
    it('should trigger scraping successfully with correct auth', async () => {
      mockConfigService.get.mockReturnValue('secret');
      mockCommandBus.execute.mockResolvedValue(undefined);

      const result = await controller.triggerColfarjuyScraping({ 'authorization': 'Bearer secret' });

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(ScrapeColfarjuyCommand));
      expect(result).toEqual({ status: 'success', message: 'Scraping process initiated and completed' });
    });

    it('should throw UnauthorizedException with wrong secret', async () => {
      mockConfigService.get.mockReturnValue('secret');
      await expect(controller.triggerColfarjuyScraping({ 'authorization': 'Bearer wrong' })).rejects.toThrow(UnauthorizedException);
    });

    it('should handle scraping errors gracefully', async () => {
      mockConfigService.get.mockReturnValue('secret');
      mockCommandBus.execute.mockRejectedValue(new Error('Scrape failed'));

      const result = await controller.triggerColfarjuyScraping({ 'x-auth-token': 'Bearer secret' });

      expect(result).toEqual({ status: 'error', message: 'Scrape failed' });
    });
  });
});
