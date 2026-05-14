import { PharmacyReport, PharmacyReportSchema, ReportSource } from './pharmacy-report.schema';

describe('PharmacyReportSchema', () => {
  it('should be defined', () => {
    expect(PharmacyReportSchema).toBeDefined();
  });

  it('should have the expected properties', () => {
    const report = new PharmacyReport();
    report.pharmacyId = 'pharmacy-id';
    report.deviceId = 'device-id';
    report.userLocation = { type: 'Point', coordinates: [1, 2] };
    report.isOnDuty = true;
    report.confidence = 0.8;
    report.source = ReportSource.COMMUNITY;
    report.isSilentlyDiscarded = false;

    expect(report.pharmacyId).toBe('pharmacy-id');
    expect(report.isOnDuty).toBe(true);
    expect(report.source).toBe(ReportSource.COMMUNITY);
  });
});
