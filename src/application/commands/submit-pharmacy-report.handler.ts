import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SubmitPharmacyReportCommand } from './submit-pharmacy-report.command';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pharmacy, PharmacyDocument } from '../../infrastructure/database/schemas/pharmacy.schema';
import { PharmacyReport, PharmacyReportDocument } from '../../infrastructure/database/schemas/pharmacy-report.schema';
import { GeoValidationService } from '../../infrastructure/security/geo-validation.service';
import { ReputationService } from '../../infrastructure/security/reputation.service';
import { BadRequestException } from '@nestjs/common';

@CommandHandler(SubmitPharmacyReportCommand)
export class SubmitPharmacyReportHandler implements ICommandHandler<SubmitPharmacyReportCommand> {
  constructor(
    @InjectModel(Pharmacy.name) private pharmacyModel: Model<PharmacyDocument>,
    @InjectModel(PharmacyReport.name) private reportModel: Model<PharmacyReportDocument>,
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

    const reportData: Partial<PharmacyReport> = {
      pharmacyId,
      deviceId,
      userId,
      userLocation: { type: 'Point', coordinates: [lng, lat] },
      isOnDuty,
      imageUrl,
      isSilentlyDiscarded: isShadowBanned,
    };

    await this.reportModel.create(reportData);
  }
}
