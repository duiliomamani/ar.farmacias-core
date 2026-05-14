import { Test, TestingModule } from '@nestjs/testing';
import { SubmitPharmacyReportHandler } from './submit-pharmacy-report.handler';
import { getModelToken } from '@nestjs/mongoose';
import { Pharmacy } from '../../infrastructure/database/schemas/pharmacy.schema';
import { PharmacyReport } from '../../infrastructure/database/schemas/pharmacy-report.schema';
import { GeoValidationService } from '../../infrastructure/security/geo-validation.service';
import { ReputationService } from '../../infrastructure/security/reputation.service';
import { SubmitPharmacyReportCommand } from './submit-pharmacy-report.command';
import { BadRequestException } from '@nestjs/common';

describe('SubmitPharmacyReportHandler', () => {
  let handler: SubmitPharmacyReportHandler;
  let pharmacyModel: any;
  let reportModel: any;
  let geoValidation: any;
  let reputationService: any;

  const mockPharmacyModel = {
    findById: jest.fn(),
  };

  const mockReportModel = {
    create: jest.fn(),
  };

  const mockGeoValidation = {
    validateGeofence: jest.fn(),
  };

  const mockReputationService = {
    getDeviceReputation: jest.fn(),
    isShadowBanned: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmitPharmacyReportHandler,
        { provide: getModelToken(Pharmacy.name), useValue: mockPharmacyModel },
        { provide: getModelToken(PharmacyReport.name), useValue: mockReportModel },
        { provide: GeoValidationService, useValue: mockGeoValidation },
        { provide: ReputationService, useValue: mockReputationService },
      ],
    }).compile();

    handler = module.get<SubmitPharmacyReportHandler>(SubmitPharmacyReportHandler);
    pharmacyModel = module.get(getModelToken(Pharmacy.name));
    reportModel = module.get(getModelToken(PharmacyReport.name));
    geoValidation = module.get(GeoValidationService);
    reputationService = module.get(ReputationService);
  });

  it('should successfully submit a report', async () => {
    const command = new SubmitPharmacyReportCommand('id', 1, 2, 'device', true);
    mockPharmacyModel.findById.mockResolvedValue({ _id: 'id', location: { coordinates: [2, 1] } });
    reputationService.getDeviceReputation.mockResolvedValue({});
    reputationService.isShadowBanned.mockReturnValue(false);

    await handler.execute(command);

    expect(mockPharmacyModel.findById).toHaveBeenCalledWith('id');
    expect(mockGeoValidation.validateGeofence).toHaveBeenCalled();
    expect(mockReportModel.create).toHaveBeenCalled();
  });

  it('should throw BadRequestException if pharmacy not found', async () => {
    const command = new SubmitPharmacyReportCommand('id', 1, 2, 'device', true);
    mockPharmacyModel.findById.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
  });
});
