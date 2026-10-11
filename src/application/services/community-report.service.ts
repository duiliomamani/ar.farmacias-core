import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac } from 'crypto';
import { isValidObjectId, Model } from 'mongoose';
import { Pharmacy, PharmacyDocument } from '../../infrastructure/database/schemas/pharmacy.schema';
import { PharmacyReport, PharmacyReportDocument, ReportSource } from '../../infrastructure/database/schemas/pharmacy-report.schema';
import { GeoValidationService } from '../../infrastructure/security/geo-validation.service';
import { ReputationService } from '../../infrastructure/security/reputation.service';

const MAX_REPORT_DISTANCE_METERS = 250;
const REPORT_UPDATE_COOLDOWN_MS = 5 * 60 * 1000;

@Injectable()
export class CommunityReportService {
  constructor(
    @InjectModel(Pharmacy.name) private readonly pharmacyModel: Model<PharmacyDocument>,
    @InjectModel(PharmacyReport.name) private readonly reportModel: Model<PharmacyReportDocument>,
    private readonly geoValidation: GeoValidationService,
    private readonly reputationService: ReputationService,
    private readonly configService: ConfigService,
  ) {}

  async submit(pharmacyId: string, lat: number, lng: number, rawDeviceId: string, isOpen: boolean) {
    if (!isValidObjectId(pharmacyId)) throw new BadRequestException('Identificador de farmacia inválido.');
    const pharmacy = await this.pharmacyModel.findById(pharmacyId);
    if (!pharmacy || !pharmacy.location) throw new NotFoundException('Farmacia o ubicación no encontrada.');
    if (!pharmacy.isVoluntary) {
      throw new BadRequestException('Los reportes comunitarios están disponibles solo para atención voluntaria.');
    }

    const now = new Date();
    if (!pharmacy.dutyFrom || !pharmacy.dutyUntil || now < pharmacy.dutyFrom || now >= pharmacy.dutyUntil) {
      throw new BadRequestException('Este turno ya no está vigente.');
    }

    const distanceMeters = this.geoValidation.getDistance(
      lat,
      lng,
      pharmacy.location.coordinates[1],
      pharmacy.location.coordinates[0],
    );
    this.geoValidation.validateGeofence(
      lat,
      lng,
      pharmacy.location.coordinates[1],
      pharmacy.location.coordinates[0],
      MAX_REPORT_DISTANCE_METERS,
    );

    const deviceId = this.hashDeviceId(rawDeviceId);
    const shiftKey = `${pharmacy.source_type}:${pharmacy.sourceId || pharmacy._id}:${pharmacy.dutyFrom.toISOString()}`;
    const existing = await this.reportModel.findOne({ pharmacyId, shiftKey, deviceId })
      .select({ updatedAt: 1 })
      .lean();
    if (existing?.updatedAt && now.getTime() - new Date(existing.updatedAt).getTime() < REPORT_UPDATE_COOLDOWN_MS) {
      throw new HttpException('Esperá unos minutos antes de actualizar tu reporte.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const reputation = await this.reputationService.getDeviceReputation(deviceId);
    const isSilentlyDiscarded = this.reputationService.isShadowBanned(reputation);
    const confidence = Math.min(1, Math.max(0.1, reputation.trustScore / 10));

    await this.reportModel.findOneAndUpdate(
      { pharmacyId, shiftKey, deviceId },
      {
        $set: {
          sourceId: pharmacy.sourceId,
          distanceMeters: Math.round(distanceMeters),
          isOnDuty: isOpen,
          confidence,
          source: ReportSource.COMMUNITY,
          isSilentlyDiscarded,
          expiresAt: pharmacy.dutyUntil,
        },
        $setOnInsert: { pharmacyId, shiftKey, deviceId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return { accepted: true, expiresAt: pharmacy.dutyUntil };
  }

  private hashDeviceId(deviceId: string): string {
    const secret = this.configService.get<string>('REPORT_DEVICE_SECRET')
      || this.configService.get<string>('TURNSTILE_SECRET_KEY')
      || 'farmaya-development-report-secret';
    return createHmac('sha256', secret).update(deviceId).digest('hex');
  }
}
