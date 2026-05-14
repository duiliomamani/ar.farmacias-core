import { Test, TestingModule } from '@nestjs/testing';
import { SubmitPharmacyReportHandler } from './submit-pharmacy-report.handler';
import { getModelToken } from '@nestjs/mongoose';
import { Pharmacy } from '../../infrastructure/database/schemas/pharmacy.schema';
import { PharmacyReport } from '../../infrastructure/database/schemas/pharmacy-report.schema';
import { User } from '../../infrastructure/database/schemas/user.schema';
import { GeoValidationService } from '../../infrastructure/security/geo-validation.service';
import { ReputationService } from '../../infrastructure/security/reputation.service';
import { SubmitPharmacyReportCommand } from './submit-pharmacy-report.command';
import { BadRequestException } from '@nestjs/common';

describe('SubmitPharmacyReportHandler', () => {
  let handler: SubmitPharmacyReportHandler;
  let pharmacyModel: any;
  let reportModel: any;
  let userModel: any;
  let geoValidation: any;
  let reputationService: any;

  const mockPharmacyModel = {
    findById: jest.fn(),
  };

  const mockReportModel = {
    create: jest.fn(),
  };

  const mockUserModel = {
    findByIdAndUpdate: jest.fn(),
  };

  const mockGeoValidation = {
    validateGeofence: jest.fn(),
  };

  const mockReputationService = {
    getDeviceReputation: jest.fn().mockResolvedValue({ score: 100 }),
    isShadowBanned: jest.fn().mockReturnValue(false),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmitPharmacyReportHandler,
        { provide: getModelToken(Pharmacy.name), useValue: mockPharmacyModel },
        { provide: getModelToken(PharmacyReport.name), useValue: mockReportModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: GeoValidationService, useValue: mockGeoValidation },
        { provide: ReputationService, useValue: mockReputationService },
      ],
    }).compile();

    handler = module.get<SubmitPharmacyReportHandler>(SubmitPharmacyReportHandler);
    pharmacyModel = module.get(getModelToken(Pharmacy.name));
    reportModel = module.get(getModelToken(PharmacyReport.name));
    userModel = module.get(getModelToken(User.name));
    geoValidation = module.get(GeoValidationService);
    reputationService = module.get(ReputationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully submit a report', async () => {
    const command = new SubmitPharmacyReportCommand('id', 1, 2, 'device', true);
    mockPharmacyModel.findById.mockResolvedValue({ location: { coordinates: [2, 1] } });
    
    await handler.execute(command);

    expect(mockPharmacyModel.findById).toHaveBeenCalledWith('id');
    expect(mockGeoValidation.validateGeofence).toHaveBeenCalled();
    expect(mockReportModel.create).toHaveBeenCalled();
  });

  it('should award 10 points to logged user', async () => {
    const command = new SubmitPharmacyReportCommand('id', 1, 2, 'device', true, undefined, 'user123');
    mockPharmacyModel.findById.mockResolvedValue({ location: { coordinates: [2, 1] } });
    mockUserModel.findByIdAndUpdate.mockResolvedValue({ trustScore: 110 });
    
    await handler.execute(command);

    expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'user123',
      { $inc: { trustScore: 10 } },
      { new: true }
    );
    expect(mockReportModel.create).toHaveBeenCalledWith(expect.objectContaining({
      confidence: 0.1 // 110 < 300
    }));
  });

  it('should set high confidence for trusted users', async () => {
    const command = new SubmitPharmacyReportCommand('id', 1, 2, 'device', true, undefined, 'user123');
    mockPharmacyModel.findById.mockResolvedValue({ location: { coordinates: [2, 1] } });
    mockUserModel.findByIdAndUpdate.mockResolvedValue({ trustScore: 350 });
    
    await handler.execute(command);

    expect(mockReportModel.create).toHaveBeenCalledWith(expect.objectContaining({
      confidence: 1.0
    }));
  });

  it('should throw BadRequestException if pharmacy not found', async () => {
    const command = new SubmitPharmacyReportCommand('id', 1, 2, 'device', true);
    mockPharmacyModel.findById.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
  });
});
