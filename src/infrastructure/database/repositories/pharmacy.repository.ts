import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pharmacy, PharmacyDocument } from '../schemas/pharmacy.schema';
import { PharmacyReport, PharmacyReportDocument } from '../schemas/pharmacy-report.schema';
import { IPharmacyRepository } from '../../../domain/interfaces/pharmacy-system.interface';
import { Pharmacy as PharmacyEntity } from '../../../domain/entities/pharmacy.entity';
import { PharmacyReport as PharmacyReportEntity } from '../../../domain/entities/pharmacy-report.entity';
import { BaseRepository } from './base.repository';

@Injectable()
export class PharmacyRepository extends BaseRepository<PharmacyEntity, PharmacyDocument> implements IPharmacyRepository {
  constructor(
    @InjectModel(Pharmacy.name) pharmacyModel: Model<PharmacyDocument>,
    @InjectModel(PharmacyReport.name) private readonly reportModel: Model<PharmacyReportDocument>,
  ) {
    super(pharmacyModel);
  }

  async upsert(pharmacy: PharmacyEntity): Promise<PharmacyEntity> {
    const updated = await this.model.findOneAndUpdate(
      { 
        name: pharmacy.name, 
        city: pharmacy.city,
        dutyFrom: pharmacy.dutyFrom,
        dutyUntil: pharmacy.dutyUntil 
      },
      pharmacy,
      { upsert: true, new: true },
    );
    return this.mapToEntity(updated!);
  }

  async findNearby(lat: number, lng: number, radiusInMeters: number, date?: Date): Promise<PharmacyEntity[]> {
    const targetTime = date || new Date();

    const query: any = {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          $maxDistance: radiusInMeters,
        },
      },
      isOnDuty: true,
      $or: [
        { isPermanentlyOnDuty: true },
        {
          dutyFrom: { $lte: targetTime },
          dutyUntil: { $gte: targetTime },
        },
      ],
    };

    const pharmacies = await this.model.find(query);
    return Promise.all(pharmacies.map(doc => this.mapToEntityWithReports(doc)));
  }

  async findByDate(date: Date, city?: string): Promise<PharmacyEntity[]> {
    // A pharmacy is considered "on duty for the date" if its shift overlaps 
    // with any part of that day (00:00 to 23:59 UTC).
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const query: any = {
      isOnDuty: true,
      $or: [
        { isPermanentlyOnDuty: true },
        {
          dutyFrom: { $lte: endOfDay },
          dutyUntil: { $gte: startOfDay },
        },
      ],
    };

    if (city) {
      query.city = city;
    }

    const pharmacies = await this.model.find(query).sort({ city: 1, name: 1 });
    return Promise.all(pharmacies.map(doc => this.mapToEntityWithReports(doc)));
  }

  private async mapToEntityWithReports(doc: PharmacyDocument): Promise<PharmacyEntity> {
    const entity = this.mapToEntity(doc);
    
    // Fetch recent community reports (last 4 hours)
    const fourHoursAgo = new Date();
    fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

    const reports = await this.reportModel
      .find({ 
        pharmacyId: doc._id, 
        isSilentlyDiscarded: false,
        createdAt: { $gte: fourHoursAgo }
      })
      .sort({ createdAt: -1 });

    entity.communityReports = reports.slice(0, 5).map(r => new PharmacyReportEntity({
      id: r._id.toString(),
      isOnDuty: r.isOnDuty,
      confidence: r.confidence,
      source: r.source,
      imageUrl: r.imageUrl,
      createdAt: (r as any).createdAt,
    }));

    // Calculate Aggregate Confidence
    // 1. High-reputation user report (confidence 1.0)
    const hasHighTrustReport = reports.some(r => r.confidence >= 1.0);
    
    // 2. Quantity of reports (10+ reports)
    const hasConsensus = reports.length >= 10;

    if (hasHighTrustReport || hasConsensus) {
      entity.statusConfidence = 1.0;
    } else {
      entity.statusConfidence = Math.min(reports.length * 0.1, 0.9);
    }

    return entity;
  }

  protected mapToEntity(doc: PharmacyDocument): PharmacyEntity {
    return new PharmacyEntity({
      id: doc._id.toString(),
      name: doc.name,
      city: doc.city,
      address: doc.originalAddress,
      location: doc.location,
      isOnDuty: doc.isOnDuty,
      dutyFrom: doc.dutyFrom,
      dutyUntil: doc.dutyUntil,
      openingHours: doc.openingHours,
      isVoluntary: doc.isVoluntary,
    });
  }
}
