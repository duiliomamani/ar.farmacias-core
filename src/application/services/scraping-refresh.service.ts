import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScrapeTurnosJujuyCommand } from '../commands/scrape-turnos-jujuy.command';
import { ScrapingRun, ScrapingRunDocument } from '../../infrastructure/database/schemas/scraping-run.schema';

const SOURCE = 'turnosjujuy.com.ar';
const DEFAULT_STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * Refreshes the official source opportunistically without delaying pharmacy
 * queries. The command handler owns the atomic MongoDB lock, so concurrent
 * requests result in at most one scraping run.
 */
@Injectable()
export class ScrapingRefreshService {
  private readonly logger = new Logger(ScrapingRefreshService.name);
  private readonly staleAfterMs = DEFAULT_STALE_AFTER_MS;

  constructor(
    private readonly commandBus: CommandBus,
    @InjectModel(ScrapingRun.name)
    private readonly scrapingRunModel: Model<ScrapingRunDocument>,
  ) {}

  refreshIfStale(requestedDate?: Date): void {
    if (!this.isCurrentDutyDate(requestedDate)) return;

    void this.refreshIfNeeded().catch((error: any) => {
      this.logger.error(`Background scraping failed: ${error?.message || error}`);
    });
  }

  private async refreshIfNeeded(): Promise<void> {
    const latest = await this.scrapingRunModel.findOne({ source: SOURCE, status: 'success' })
      .sort({ finishedAt: -1, startedAt: -1 })
      .select({ finishedAt: 1, startedAt: 1 })
      .lean();
    const lastSuccessfulAt = latest?.finishedAt || latest?.startedAt;
    const isFresh = lastSuccessfulAt && Date.now() - new Date(lastSuccessfulAt).getTime() < this.staleAfterMs;
    if (isFresh) return;

    this.logger.log('Latest scraping result is stale; refreshing in background.');
    await this.commandBus.execute(new ScrapeTurnosJujuyCommand());
  }

  private isCurrentDutyDate(requestedDate?: Date): boolean {
    if (!requestedDate) return true;

    const requested = this.formatArgentinaDate(requestedDate);
    const now = this.getArgentinaClock();
    const activeDate = new Date(`${now.date}T12:00:00-03:00`);
    if (now.hour < 8) activeDate.setUTCDate(activeDate.getUTCDate() - 1);

    return requested === this.formatArgentinaDate(activeDate);
  }

  private getArgentinaClock(): { date: string; hour: number } {
    const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      hour: Number(values.hour),
    };
  }

  private formatArgentinaDate(date: Date): string {
    const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date).map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
}
