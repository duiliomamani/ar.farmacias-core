import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScrapeTurnosJujuyCommand } from '../commands/scrape-turnos-jujuy.command';
import { ScrapingRun, ScrapingRunDocument } from '../../infrastructure/database/schemas/scraping-run.schema';

const SOURCE = 'turnosjujuy.com.ar';
const SCRAPER_VERSION = 2;
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
  private refreshInFlight?: Promise<void>;

  constructor(
    private readonly commandBus: CommandBus,
    @InjectModel(ScrapingRun.name)
    private readonly scrapingRunModel: Model<ScrapingRunDocument>,
  ) {}

  async refreshIfStale(requestedDate?: Date): Promise<void> {
    if (!this.isCurrentDutyDate(requestedDate)) return;

    // Coalesce simultaneous queries handled by this process. The command
    // handler also owns a MongoDB lock for requests reaching other instances.
    if (!this.refreshInFlight) {
      const refresh = this.refreshIfNeeded();
      this.refreshInFlight = refresh;
      const clearRefresh = () => {
        if (this.refreshInFlight === refresh) this.refreshInFlight = undefined;
      };
      void refresh.then(clearRefresh, clearRefresh);
    }

    await this.refreshInFlight;
  }

  private async refreshIfNeeded(): Promise<void> {
    const latest = await this.scrapingRunModel.findOne({
      source: SOURCE,
      status: 'success',
      pipelineVersion: SCRAPER_VERSION,
    })
      .sort({ finishedAt: -1, startedAt: -1 })
      .select({ finishedAt: 1, startedAt: 1 })
      .lean();
    const lastSuccessfulAt = latest?.finishedAt || latest?.startedAt;
    const lastSuccessfulTime = lastSuccessfulAt ? new Date(lastSuccessfulAt).getTime() : 0;
    const isFresh = lastSuccessfulTime >= this.getActiveDutyStartedAt().getTime()
      && Date.now() - lastSuccessfulTime < this.staleAfterMs;
    if (isFresh) return;

    this.logger.log('Latest scraping result is stale; refreshing before serving pharmacy data.');
    await this.commandBus.execute(new ScrapeTurnosJujuyCommand());
  }

  private getActiveDutyStartedAt(): Date {
    const now = this.getArgentinaClock();
    const activeDate = new Date(`${now.date}T08:00:00-03:00`);
    if (now.hour < 8) activeDate.setUTCDate(activeDate.getUTCDate() - 1);
    return activeDate;
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
