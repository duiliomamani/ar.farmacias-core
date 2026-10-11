import { BadRequestException } from '@nestjs/common';
import { CommunityReportService } from './community-report.service';

describe('CommunityReportService', () => {
  const now = new Date('2026-10-11T15:00:00.000Z');
  const pharmacy = {
    _id: '507f1f77bcf86cd799439011',
    sourceId: '476',
    source_type: 'TURNOS_JUJUY_HTML',
    isVoluntary: true,
    dutyFrom: new Date('2026-10-11T11:00:00.000Z'),
    dutyUntil: new Date('2026-10-12T11:00:00.000Z'),
    location: { type: 'Point', coordinates: [-65.30, -24.18] },
  };

  const existingQuery = (value: any) => ({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('upserts one report for the current voluntary shift', async () => {
    jest.useFakeTimers().setSystemTime(now);
    const pharmacyModel = { findById: jest.fn().mockResolvedValue(pharmacy) };
    const reportModel = {
      findOne: jest.fn().mockReturnValue(existingQuery(null)),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const geoValidation = {
      getDistance: jest.fn().mockReturnValue(18.4),
      validateGeofence: jest.fn().mockReturnValue(true),
    };
    const reputation = {
      getDeviceReputation: jest.fn().mockResolvedValue({ trustScore: 5 }),
      isShadowBanned: jest.fn().mockReturnValue(false),
    };
    const config = { get: jest.fn().mockReturnValue('secret') };
    const service = new CommunityReportService(
      pharmacyModel as any,
      reportModel as any,
      geoValidation as any,
      reputation as any,
      config as any,
    );

    const result = await service.submit(pharmacy._id, -24.18, -65.30, 'raw-device', true);

    expect(result).toEqual({ accepted: true, expiresAt: pharmacy.dutyUntil });
    expect(geoValidation.validateGeofence).toHaveBeenCalledWith(-24.18, -65.30, -24.18, -65.30, 250);
    expect(reportModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ pharmacyId: pharmacy._id, shiftKey: expect.stringContaining('476'), deviceId: expect.any(String) }),
      expect.objectContaining({ $set: expect.objectContaining({ isOnDuty: true, expiresAt: pharmacy.dutyUntil }) }),
      expect.objectContaining({ upsert: true }),
    );
  });

  it('rejects reports for a non-voluntary pharmacy', async () => {
    jest.useFakeTimers().setSystemTime(now);
    const service = new CommunityReportService(
      { findById: jest.fn().mockResolvedValue({ ...pharmacy, isVoluntary: false }) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.submit(pharmacy._id, -24.18, -65.30, 'device', true))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
