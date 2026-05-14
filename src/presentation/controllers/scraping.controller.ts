import { Controller, Post, Headers, UnauthorizedException, Logger, Get } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ScrapeColfarjuyCommand } from '../../application/commands/scrape-colfarjuy.command';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ApiRes } from 'src/application/dtos/api-response.dto';

@ApiTags('scraping')
@Controller('api/scraping')
export class ScrapingController {
  private readonly logger = new Logger(ScrapingController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly configService: ConfigService,
  ) { }

  @Get('colfarjuy')
  @ApiOperation({ summary: 'Trigger the Colfarjuy scraping process (Vercel Cron)' })
  @ApiHeader({ name: 'authorization', description: 'Bearer <CRON_SECRET>' })
  @ApiResponse({ status: 200, description: 'Scraping process completed' })
  @ApiResponse({ status: 401, description: 'Invalid cron secret' })
  async triggerColfarjuyScraping(@Headers() headers: any) {
    const authHeader = headers['authorization'];
    this.validateCronAuth(authHeader);

    this.logger.log('--- STARTING COLFARJUY SCRAPING PROCESS ---');
    try {
      this.logger.log('Dispatching ScrapeColfarjuyCommand to the command bus...');
      await this.commandBus.execute(new ScrapeColfarjuyCommand());
      this.logger.log('--- COLFARJUY SCRAPING PROCESS COMPLETED SUCCESSFULLY ---');
      return ApiRes.success({ status: 'success', message: 'Scraping process initiated and completed' });
    } catch (error: any) {
      this.logger.error(`Scraping failed: ${error.message}`);
      return ApiRes.singleError('SCRAPING_FAILED', error.message);
    }
  }

  private validateCronAuth(authHeader: string) {
    const cronSecret = this.configService.get<string>('CRON_SECRET');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      throw new UnauthorizedException('Invalid cron secret');
    }
  }
}
