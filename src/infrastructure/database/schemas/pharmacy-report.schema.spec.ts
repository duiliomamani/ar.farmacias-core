import { PharmacyReport, PharmacyReportSchema, ReportSource } from './pharmacy-report.schema';

describe('PharmacyReportSchema', () => {
  it('should be defined', () => {
    expect(PharmacyReportSchema).toBeDefined();
  });

  it('should have the expected properties', () => {
    const report = new PharmacyReport();
    report.pharmacyId = 'pharmacy-id';
    report.deviceId = 'device-id';
    report.shiftKey = 'source:pharmacy:2026-10-11';
    report.distanceMeters = 25;
    report.isOnDuty = true;
    report.confidence = 0.8;
    report.source = ReportSource.COMMUNITY;
    report.isSilentlyDiscarded = false;
    report.expiresAt = new Date('2026-10-12T11:00:00.000Z');

    expect(report.pharmacyId).toBe('pharmacy-id');
    expect(report.isOnDuty).toBe(true);
    expect(report.source).toBe(ReportSource.COMMUNITY);
    expect(report.shiftKey).toBe('source:pharmacy:2026-10-11');
  });
});
