import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pharmacy, PharmacyDocument } from '../schemas/pharmacy.schema';
import { IPharmacyRepository } from '../../../domain/interfaces/pharmacy-system.interface';
import { Pharmacy as PharmacyEntity } from '../../../domain/entities/pharmacy.entity';
import { BaseRepository } from './base.repository';
import { PharmacyReport, PharmacyReportDocument } from '../schemas/pharmacy-report.schema';

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
    let queryDateFilter: any;

    if (date) {
      // If a specific date is provided, we look for anything overlapping that entire day (UTC)
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      queryDateFilter = {
        $or: [
          { isPermanentlyOnDuty: true },
          {
            dutyFrom: { $lte: endOfDay },
            dutyUntil: { $gte: startOfDay },
          },
        ],
      };
    } else {
      // If no date is provided, we look for pharmacies on duty in the next 24 hours
      // This satisfies the "today until tomorrow" requirement.
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      queryDateFilter = {
        $or: [
          { isPermanentlyOnDuty: true },
          {
            dutyFrom: { $lte: tomorrow },
            dutyUntil: { $gte: now },
          },
        ],
      };
    }

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
      $and: [
        { $or: [{ isOnDuty: true }, { isVoluntary: true }] },
        queryDateFilter,
      ],
    };

    const pharmacies = await this.model.find(query);
    return this.mapWithCommunityReports(pharmacies);
  }

  async findByDate(date: Date, city?: string): Promise<PharmacyEntity[]> {
    // A pharmacy is considered "on duty for the date" if its shift overlaps 
    // with any part of that day (00:00 to 23:59 UTC).
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const query: any = {
      $and: [
        { $or: [{ isOnDuty: true }, { isVoluntary: true }] },
        {
          $or: [
            { isPermanentlyOnDuty: true },
            {
              dutyFrom: { $lte: endOfDay },
              dutyUntil: { $gte: startOfDay },
            },
          ],
        },
      ],
    };

    if (city) {
      query.city = city;
    }

    const pharmacies = await this.model.find(query).sort({ city: 1, name: 1 });
    return this.mapWithCommunityReports(pharmacies);
  }

  private async mapWithCommunityReports(pharmacies: PharmacyDocument[]): Promise<PharmacyEntity[]> {
    if (pharmacies.length === 0) return [];

    const pharmacyIds = pharmacies.map((pharmacy) => pharmacy._id);
    const recentSince = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const reports = await this.reportModel.find({
      pharmacyId: { $in: pharmacyIds },
      expiresAt: { $gt: new Date() },
      updatedAt: { $gte: recentSince },
      isSilentlyDiscarded: false,
    }).sort({ createdAt: -1 }).lean();
    const reportsByPharmacy = new Map<string, any[]>();
    for (const report of reports as any[]) {
      const key = String(report.pharmacyId);
      const current = reportsByPharmacy.get(key) || [];
      current.push(report);
      reportsByPharmacy.set(key, current);
    }

    return pharmacies.map((doc) => this.mapToEntity(doc, reportsByPharmacy.get(doc._id.toString()) || []));
  }

  protected mapToEntity(doc: PharmacyDocument, communityReports: any[] = []): PharmacyEntity {
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
      isPermanentlyOnDuty: doc.isPermanentlyOnDuty,
      communityReports: communityReports.map((report) => ({
        id: report._id?.toString(),
        isOnDuty: report.isOnDuty,
        confidence: report.confidence,
        source: report.source,
        createdAt: report.updatedAt || report.createdAt,
      })),
      statusConfidence: 0,
    });
  }
}
