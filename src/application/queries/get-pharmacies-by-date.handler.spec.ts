import { Test, TestingModule } from '@nestjs/testing';
import { GetPharmaciesByDateHandler } from './get-pharmacies-by-date.handler';
import { GetPharmaciesByDateQuery } from './get-pharmacies-by-date.query';
import { IPharmacyRepository } from '../../domain/interfaces/pharmacy-system.interface';
import { Pharmacy } from '../../domain/entities/pharmacy.entity';

describe('GetPharmaciesByDateHandler', () => {
  let handler: GetPharmaciesByDateHandler;
  let pharmacyRepository: jest.Mocked<IPharmacyRepository>;

  beforeEach(async () => {
    pharmacyRepository = {
      upsert: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      findByDate: jest.fn(),
      findNearby: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPharmaciesByDateHandler,
        {
          provide: 'IPharmacyRepository',
          useValue: pharmacyRepository,
        },
      ],
    }).compile();

    handler = module.get<GetPharmaciesByDateHandler>(GetPharmaciesByDateHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should call repository.findByDate with correct parameters', async () => {
    const testDate = new Date('2026-05-13T00:00:00Z');
    const query = new GetPharmaciesByDateQuery(testDate, 'San Salvador de Jujuy');
    
    const expectedResult: Pharmacy[] = [
      { id: '1', name: 'Farmacia 1', city: 'San Salvador de Jujuy', isOnDuty: true, dutyUntil: new Date('2026-05-14T08:00:00Z') } as any
    ];

    pharmacyRepository.findByDate.mockResolvedValue(expectedResult);

    const result = await handler.execute(query);

    expect(pharmacyRepository.findByDate).toHaveBeenCalledWith(testDate, 'San Salvador de Jujuy');
    expect(pharmacyRepository.findByDate).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expectedResult);
  });

  it('should call repository.findByDate without city if not provided', async () => {
    const testDate = new Date('2026-05-13T00:00:00Z');
    const query = new GetPharmaciesByDateQuery(testDate);
    
    pharmacyRepository.findByDate.mockResolvedValue([]);

    await handler.execute(query);

    expect(pharmacyRepository.findByDate).toHaveBeenCalledWith(testDate, undefined);
  });
});
