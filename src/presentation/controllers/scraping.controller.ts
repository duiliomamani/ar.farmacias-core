import { Controller, Post, Headers, UnauthorizedException, Logger, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CommandBus } from '@nestjs/cqrs';
import { ScrapeTurnosJujuyCommand } from '../../application/commands/scrape-turnos-jujuy.command';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ApiRes } from '../../application/dtos/api-response.dto';
import { ScrapingRun, ScrapingRunDocument } from '../../infrastructure/database/schemas/scraping-run.schema';

@ApiTags('scraping')
@Controller('api/scraping')
export class ScrapingController {
  private readonly logger = new Logger(ScrapingController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly configService: ConfigService,
    @InjectModel(ScrapingRun.name) private readonly scrapingRunModel: Model<ScrapingRunDocument>,
  ) { }

  @Get('turnos-jujuy/status')
  @ApiOperation({ summary: 'Get the latest official Jujuy HTML scraping status' })
  async getTurnosJujuyStatus() {
    const latest = await this.scrapingRunModel.findOne({ source: 'turnosjujuy.com.ar' })
      .sort({ startedAt: -1 })
      .lean();
    return ApiRes.success(latest || null);
  }

  @Get('turnos-jujuy')
  @ApiOperation({ summary: 'Trigger the official Jujuy HTML scraping process (Vercel Cron)' })
  @ApiHeader({ name: 'x-auth-token', description: '<CRON_SECRET>' })
  @ApiResponse({ status: 200, description: 'Scraping process completed' })
  @ApiResponse({ status: 401, description: 'Invalid cron secret' })
  async triggerTurnosJujuyScraping(@Headers() headers: any) {
    const authHeader = headers['x-auth-token'];
    this.validateCronAuth(authHeader);

    this.logger.log('--- STARTING TURNOS JUJUY HTML SCRAPING PROCESS ---');
    try {
      this.logger.log('Dispatching ScrapeTurnosJujuyCommand to the command bus...');
      await this.commandBus.execute(new ScrapeTurnosJujuyCommand());
      this.logger.log('--- TURNOS JUJUY HTML SCRAPING PROCESS COMPLETED SUCCESSFULLY ---');
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
