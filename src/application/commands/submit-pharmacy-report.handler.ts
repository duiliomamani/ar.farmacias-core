import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SubmitPharmacyReportCommand } from './submit-pharmacy-report.command';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pharmacy, PharmacyDocument } from '../../infrastructure/database/schemas/pharmacy.schema';
import { PharmacyReport, PharmacyReportDocument } from '../../infrastructure/database/schemas/pharmacy-report.schema';
import { User, UserDocument } from '../../infrastructure/database/schemas/user.schema';
import { GeoValidationService } from '../../infrastructure/security/geo-validation.service';
import { ReputationService } from '../../infrastructure/security/reputation.service';
import { BadRequestException } from '@nestjs/common';

@CommandHandler(SubmitPharmacyReportCommand)
export class SubmitPharmacyReportHandler implements ICommandHandler<SubmitPharmacyReportCommand> {
  constructor(
    @InjectModel(Pharmacy.name) private pharmacyModel: Model<PharmacyDocument>,
    @InjectModel(PharmacyReport.name) private reportModel: Model<PharmacyReportDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly geoValidation: GeoValidationService,
    private readonly reputationService: ReputationService,
  ) {}

  async execute(command: SubmitPharmacyReportCommand): Promise<void> {
    const { pharmacyId, lat, lng, deviceId, isOnDuty, imageUrl, userId } = command;

    // Layer 1: Geofencing
    const pharmacy = await this.pharmacyModel.findById(pharmacyId);
    if (!pharmacy || !pharmacy.location) {
      throw new BadRequestException('Pharmacy or location not found');
    }

    this.geoValidation.validateGeofence(
      lat,
      lng,
      pharmacy.location.coordinates[1],
      pharmacy.location.coordinates[0],
    );

    // Layer 2: Trust & Shadowbanning
    const reputation = await this.reputationService.getDeviceReputation(deviceId);
    const isShadowBanned = this.reputationService.isShadowBanned(reputation);

    // Layer 3: Points & User Reputation
    let userPoints = 0;
    if (userId) {
      const user = await this.userModel.findByIdAndUpdate(
        userId,
        { $inc: { trustScore: 10 } },
        { new: true }
      );
      userPoints = user?.trustScore || 0;
    }

    const reportData: Partial<PharmacyReport> = {
      pharmacyId,
      deviceId,
      userId,
      userLocation: { type: 'Point', coordinates: [lng, lat] },
      isOnDuty,
      imageUrl,
      isSilentlyDiscarded: isShadowBanned,
      // Confidence is based on user points. If user has > 300, report is 1.0 (max)
      confidence: userPoints >= 300 ? 1.0 : 0.1,
    };

    await this.reportModel.create(reportData);
  }
}
