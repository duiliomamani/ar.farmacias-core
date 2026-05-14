import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PharmacyRepository } from './pharmacy.repository';
import { Pharmacy } from '../schemas/pharmacy.schema';
import { PharmacyReport } from '../schemas/pharmacy-report.schema';
import { Pharmacy as PharmacyEntity } from '../../../domain/entities/pharmacy.entity';
import { Model } from 'mongoose';

describe('PharmacyRepository', () => {
  let repository: PharmacyRepository;
  let model: Model<any>;
  let reportModel: Model<any>;

  const mockPharmacyDoc = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test Pharmacy',
    city: 'San Salvador de Jujuy',
    originalAddress: 'Test Address',
    location: { type: 'Point', coordinates: [1, 2] },
    georef: { provinciaId: '1', municipioId: '2', localidadId: '3' },
    isOnDuty: true,
    dutyFrom: new Date(),
    dutyUntil: new Date(new Date().getTime() + 100000), // In the future
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPharmacyModel = {
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };

  const mockReportModel = {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyRepository,
        {
          provide: getModelToken(Pharmacy.name),
          useValue: mockPharmacyModel,
        },
        {
          provide: getModelToken(PharmacyReport.name),
          useValue: mockReportModel,
        },
      ],
    }).compile();

    repository = module.get<PharmacyRepository>(PharmacyRepository);
    model = module.get<Model<any>>(getModelToken(Pharmacy.name));
    reportModel = module.get<Model<any>>(getModelToken(PharmacyReport.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('upsert', () => {
    it('should call findOneAndUpdate with shift-based filter', async () => {
      const entity = new PharmacyEntity({
        name: 'Test Pharmacy',
        city: 'Jujuy',
        dutyFrom: new Date('2026-06-01T08:00:00Z'),
        dutyUntil: new Date('2026-06-02T08:00:00Z'),
        georef: { provinciaId: '1', municipioId: '2', localidadId: '3' } as any,
      } as any);

      mockPharmacyModel.findOneAndUpdate.mockResolvedValue(mockPharmacyDoc);

      const result = await repository.upsert(entity);

      expect(mockPharmacyModel.findOneAndUpdate).toHaveBeenCalledWith(
        { 
          name: entity.name, 
          city: entity.city,
          dutyFrom: entity.dutyFrom,
          dutyUntil: entity.dutyUntil 
        },
        entity,
        { upsert: true, new: true },
      );
      expect(result).toBeInstanceOf(PharmacyEntity);
    });
  });

  describe('findNearby', () => {
    it('should call find with geo query and $or filter for duty', async () => {
      const lat = -24.18;
      const lng = -65.30;
      const radius = 1000;

      mockPharmacyModel.find.mockResolvedValue([mockPharmacyDoc]);

      const result = await repository.findNearby(lat, lng, radius);

      expect(mockPharmacyModel.find).toHaveBeenCalledWith(expect.objectContaining({
        location: expect.anything(),
        isOnDuty: true,
        $or: expect.arrayContaining([
          { isPermanentlyOnDuty: true },
          expect.objectContaining({
            dutyFrom: { $lte: expect.any(Date) },
            dutyUntil: { $gte: expect.any(Date) },
          })
        ]),
      }));
      expect(result).toHaveLength(1);
    });
  });

  describe('findByDate', () => {
    it('should call find with overlapping range filter', async () => {
      const date = new Date('2026-05-13');
      mockPharmacyModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([mockPharmacyDoc]),
      });

      const result = await repository.findByDate(date);

      expect(mockPharmacyModel.find).toHaveBeenCalledWith(expect.objectContaining({
        isOnDuty: true,
        $or: expect.arrayContaining([
          { isPermanentlyOnDuty: true },
          expect.objectContaining({
            dutyFrom: { $lte: expect.any(Date) },
            dutyUntil: { $gte: expect.any(Date) },
          })
        ]),
      }));
      expect(result).toHaveLength(1);
    });
  });
});
