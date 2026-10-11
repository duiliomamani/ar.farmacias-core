import { CommandBus } from '@nestjs/cqrs';
import { ScrapingRefreshService } from './scraping-refresh.service';

describe('ScrapingRefreshService', () => {
  const findLatest = (latest: any) => ({
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(latest),
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for a stale refresh to finish', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-11T13:00:00.000Z'));
    let finishScraping!: () => void;
    const scraping = new Promise<void>((resolve) => { finishScraping = resolve; });
    const commandBus = { execute: jest.fn().mockReturnValue(scraping) } as unknown as CommandBus;
    const model = { findOne: jest.fn().mockReturnValue(findLatest(null)) } as any;
    const service = new ScrapingRefreshService(commandBus, model);

    let completed = false;
    const refresh = service.refreshIfStale(new Date('2026-10-11T15:00:00.000Z'))
      .then(() => { completed = true; });
    await Promise.resolve();

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(model.findOne).toHaveBeenCalledWith({
      source: 'turnosjujuy.com.ar',
      status: 'success',
      pipelineVersion: 2,
    });
    expect(completed).toBe(false);

    finishScraping();
    await refresh;
    expect(completed).toBe(true);
  });

  it('does not refresh a result newer than the current duty boundary', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-11T13:00:00.000Z'));
    const commandBus = { execute: jest.fn() } as unknown as CommandBus;
    const model = {
      findOne: jest.fn().mockReturnValue(findLatest({ finishedAt: new Date('2026-10-11T12:50:00.000Z') })),
    } as any;
    const service = new ScrapingRefreshService(commandBus, model);

    await service.refreshIfStale(new Date('2026-10-11T15:00:00.000Z'));

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('refreshes after 08:00 even when the previous run is less than 30 minutes old', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-11T11:05:00.000Z'));
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) } as unknown as CommandBus;
    const model = {
      findOne: jest.fn().mockReturnValue(findLatest({ finishedAt: new Date('2026-10-11T10:55:00.000Z') })),
    } as any;
    const service = new ScrapingRefreshService(commandBus, model);

    await service.refreshIfStale(new Date('2026-10-11T15:00:00.000Z'));

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
  });

  it('does not refresh historical dates', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-11T13:00:00.000Z'));
    const commandBus = { execute: jest.fn() } as unknown as CommandBus;
    const model = { findOne: jest.fn() } as any;
    const service = new ScrapingRefreshService(commandBus, model);

    await service.refreshIfStale(new Date('2026-10-10T15:00:00.000Z'));

    expect(model.findOne).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
