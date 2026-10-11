import { Test, TestingModule } from '@nestjs/testing';
import { GetNearbyPharmaciesHandler } from './get-nearby-pharmacies.handler';
import { GetNearbyPharmaciesQuery } from './get-nearby-pharmacies.query';
import { ScrapingRefreshService } from '../services/scraping-refresh.service';

describe('GetNearbyPharmaciesHandler', () => {
  let handler: GetNearbyPharmaciesHandler;
  let repository: any;
  let scrapingRefreshService: { refreshIfStale: jest.Mock };

  const mockRepository = {
    findNearby: jest.fn(),
  };

  beforeEach(async () => {
    scrapingRefreshService = { refreshIfStale: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetNearbyPharmaciesHandler,
        { provide: 'IPharmacyRepository', useValue: mockRepository },
        { provide: ScrapingRefreshService, useValue: scrapingRefreshService },
      ],
    }).compile();

    handler = module.get<GetNearbyPharmaciesHandler>(GetNearbyPharmaciesHandler);
    repository = module.get('IPharmacyRepository');
  });

  it('should call repository.findNearby', async () => {
    const query = new GetNearbyPharmaciesQuery(1, 2, 100);
    const mockResult = [{ name: 'Fcia' }];
    mockRepository.findNearby.mockResolvedValue(mockResult);

    const result = await handler.execute(query);

    expect(repository.findNearby).toHaveBeenCalledWith(1, 2, 100, undefined);
    expect(scrapingRefreshService.refreshIfStale).toHaveBeenCalledWith(undefined);
    expect(scrapingRefreshService.refreshIfStale.mock.invocationCallOrder[0])
      .toBeLessThan(repository.findNearby.mock.invocationCallOrder[0]);
    expect(result).toEqual(mockResult);
  });
});
