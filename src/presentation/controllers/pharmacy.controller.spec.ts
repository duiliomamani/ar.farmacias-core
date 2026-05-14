import { Test, TestingModule } from '@nestjs/testing';
import { PharmacyController } from './pharmacy.controller';
import { QueryBus } from '@nestjs/cqrs';
import { GetNearbyPharmaciesQuery } from '../../application/queries/get-nearby-pharmacies.query';
import { GetNearbyPharmaciesDto } from '../../application/dtos/get-nearby-pharmacies.dto';

describe('PharmacyController', () => {
  let controller: PharmacyController;
  let queryBus: any;

  const mockQueryBus = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PharmacyController],
      providers: [
        {
          provide: QueryBus,
          useValue: mockQueryBus,
        },
      ],
    }).compile();

    controller = module.get<PharmacyController>(PharmacyController);
    queryBus = module.get(QueryBus);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNearby', () => {
    it('should execute GetNearbyPharmaciesQuery with correct parameters', async () => {
      const dto: GetNearbyPharmaciesDto = {
        lat: -34.6037,
        lng: -58.3816,
        radius: 1000,
      };
      const mockResult = [{ name: 'Pharmacy 1' }];
      mockQueryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getNearby(dto);

      expect(queryBus.execute).toHaveBeenCalledWith(expect.any(GetNearbyPharmaciesQuery));
      expect(result).toEqual({ data: mockResult, isSuccessful: true, errors: [] });
    });

    it('should use default radius if not provided', async () => {
      const dto: GetNearbyPharmaciesDto = {
        lat: -34.6037,
        lng: -58.3816,
      };
      mockQueryBus.execute.mockResolvedValue([]);

      await controller.getNearby(dto);

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ radius: 5000 })
      );
    });
  });

  describe('getByDate', () => {
    it('should execute GetPharmaciesByDateQuery with correct parameters', async () => {
      const dto = {
        date: '2026-05-20',
        city: 'Ciudad de Perico',
      };
      const mockResult = [{ name: 'Pharmacy 2' }];
      mockQueryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getByDate(dto);

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Ciudad de Perico' })
      );
      expect(result).toEqual({ data: mockResult, isSuccessful: true, errors: [] });
    });

    it('should handle dates with timezone information properly', async () => {
      const dto = {
        date: '2026-05-20T00:00:00Z',
      };
      mockQueryBus.execute.mockResolvedValue([]);

      await controller.getByDate(dto);

      expect(queryBus.execute).toHaveBeenCalled();
    });
  });
});
