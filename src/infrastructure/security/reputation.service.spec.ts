import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ReputationService } from './reputation.service';
import { DeviceReputation } from '../database/schemas/device-reputation.schema';

describe('ReputationService', () => {
  let service: ReputationService;
  let model: any;

  const mockDeviceModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReputationService,
        {
          provide: getModelToken(DeviceReputation.name),
          useValue: mockDeviceModel,
        },
      ],
    }).compile();

    service = module.get<ReputationService>(ReputationService);
    model = module.get(getModelToken(DeviceReputation.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDeviceReputation', () => {
    it('should return existing device if found', async () => {
      const deviceId = 'test-id';
      const mockDevice = { deviceId, trustScore: 1 };
      mockDeviceModel.findOne.mockResolvedValue(mockDevice);

      const result = await service.getDeviceReputation(deviceId);

      expect(mockDeviceModel.findOne).toHaveBeenCalledWith({ deviceId });
      expect(result).toEqual(mockDevice);
    });

    it('should create and return new device if not found', async () => {
      const deviceId = 'new-id';
      const mockDevice = { deviceId, trustScore: 1 };
      mockDeviceModel.findOne.mockResolvedValue(null);
      mockDeviceModel.create.mockResolvedValue(mockDevice);

      const result = await service.getDeviceReputation(deviceId);

      expect(mockDeviceModel.create).toHaveBeenCalledWith({ deviceId });
      expect(result).toEqual(mockDevice);
    });
  });

  describe('increaseTrust', () => {
    it('should call updateOne with $inc', async () => {
      const deviceId = 'test-id';
      await service.increaseTrust(deviceId);
      expect(mockDeviceModel.updateOne).toHaveBeenCalledWith(
        { deviceId },
        { $inc: { trustScore: 0.5, successfulReports: 1 } },
      );
    });
  });

  describe('blockDevice', () => {
    it('should call updateOne with $set trustScore 0', async () => {
      const deviceId = 'test-id';
      await service.blockDevice(deviceId);
      expect(mockDeviceModel.updateOne).toHaveBeenCalledWith(
        { deviceId },
        { $set: { trustScore: 0 } },
      );
    });
  });

  describe('isShadowBanned', () => {
    it('should return true if trustScore is 0', () => {
      expect(service.isShadowBanned({ trustScore: 0 } as any)).toBe(true);
    });

    it('should return false if trustScore is > 0', () => {
      expect(service.isShadowBanned({ trustScore: 1 } as any)).toBe(false);
    });
  });
});
