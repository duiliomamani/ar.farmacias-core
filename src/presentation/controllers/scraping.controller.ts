import { Controller, Post, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ScrapeColfarjuyCommand } from '../../application/commands/scrape-colfarjuy.command';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';

@ApiTags('scraping')
@Controller('api/scraping')
export class ScrapingController {
  private readonly logger = new Logger(ScrapingController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly configService: ConfigService,
  ) { }

  @Post('colfarjuy')
  @ApiOperation({ summary: 'Trigger the Colfarjuy scraping process (Vercel Cron)' })
  @ApiHeader({ name: 'x-auth-token', description: 'Bearer <CRON_SECRET>' })
  @ApiResponse({ status: 200, description: 'Scraping process completed' })
  @ApiResponse({ status: 401, description: 'Invalid cron secret' })
  async triggerColfarjuyScraping(@Headers() headers: any) {
    this.logger.log(`Headers received: ${JSON.stringify(headers)}`);
    const authHeader = headers['x-auth-token'] || headers['X-Auth-Token'];
    this.logger.log(`Resolved authHeader: ${authHeader ? 'Present' : 'Missing'}`);
    this.validateCronAuth(authHeader);

    this.logger.log('Scraping triggered via API (Vercel Cron)');

    try {
      await this.commandBus.execute(new ScrapeColfarjuyCommand());
      return { status: 'success', message: 'Scraping process initiated and completed' };
    } catch (error: any) {
      this.logger.error(`Scraping failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  private validateCronAuth(authHeader: string) {
    const cronSecret = this.configService.get<string>('CRON_SECRET');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      throw new UnauthorizedException('Invalid cron secret');
    }
  }
}
