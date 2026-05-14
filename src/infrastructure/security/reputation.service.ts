import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DeviceReputation, DeviceReputationDocument } from '../database/schemas/device-reputation.schema';

@Injectable()
export class ReputationService {
  constructor(
    @InjectModel(DeviceReputation.name)
    private deviceModel: Model<DeviceReputationDocument>,
  ) {}

  async getDeviceReputation(deviceId: string): Promise<DeviceReputationDocument> {
    let device = await this.deviceModel.findOne({ deviceId });
    if (!device) {
      device = await this.deviceModel.create({ deviceId });
    }
    return device;
  }

  async increaseTrust(deviceId: string): Promise<void> {
    await this.deviceModel.updateOne(
      { deviceId },
      { $inc: { trustScore: 0.5, successfulReports: 1 } },
    );
  }

  async blockDevice(deviceId: string): Promise<void> {
    await this.deviceModel.updateOne(
      { deviceId },
      { $set: { trustScore: 0 } },
    );
  }

  isShadowBanned(reputation: DeviceReputation): boolean {
    return reputation.trustScore === 0;
  }
}
