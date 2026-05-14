import { Test, TestingModule } from '@nestjs/testing';
import { GetNearbyPharmaciesHandler } from './get-nearby-pharmacies.handler';
import { GetNearbyPharmaciesQuery } from './get-nearby-pharmacies.query';

describe('GetNearbyPharmaciesHandler', () => {
  let handler: GetNearbyPharmaciesHandler;
  let repository: any;

  const mockRepository = {
    findNearby: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetNearbyPharmaciesHandler,
        { provide: 'IPharmacyRepository', useValue: mockRepository },
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
    expect(result).toEqual(mockResult);
  });
});
