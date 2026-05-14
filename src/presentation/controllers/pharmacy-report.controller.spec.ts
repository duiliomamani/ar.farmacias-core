import { Test, TestingModule } from '@nestjs/testing';
import { PharmacyReportController } from './pharmacy-report.controller';
import { CommandBus } from '@nestjs/cqrs';
import { SubmitPharmacyReportCommand } from '../../application/commands/submit-pharmacy-report.command';

describe('PharmacyReportController', () => {
  let controller: PharmacyReportController;
  let commandBus: any;

  const mockCommandBus = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PharmacyReportController],
      providers: [
        { provide: CommandBus, useValue: mockCommandBus },
      ],
    }).compile();

    controller = module.get<PharmacyReportController>(PharmacyReportController);
    commandBus = module.get(CommandBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('submitReport', () => {
    const body = {
      pharmacyId: 'id',
      lat: 1,
      lng: 2,
      deviceId: 'device',
      isOnDuty: true,
      imageUrl: 'url',
    };

    it('should execute SubmitPharmacyReportCommand successfully', async () => {
      mockCommandBus.execute.mockResolvedValue(undefined);
      const req = { user: { userId: 'user-123' } };

      const result = await controller.submitReport(body, req);

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(SubmitPharmacyReportCommand));
      expect(result).toBe(true);
    });
  });
});
