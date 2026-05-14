import { validate } from 'class-validator';
import { SubmitReportDto } from './submit-report.dto';

describe('SubmitReportDto', () => {
  it('should validate a correct DTO', async () => {
    const dto = new SubmitReportDto();
    dto.pharmacyId = '12345';
    dto.lat = -24.1858;
    dto.lng = -65.2995;
    dto.deviceId = 'device-123';
    dto.isOnDuty = true;
    dto.imageUrl = 'https://example.com/photo.jpg';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail if required fields are missing', async () => {
    const dto = new SubmitReportDto();
    const errors = await validate(dto);
    
    expect(errors.length).toBeGreaterThan(0);
    const properties = errors.map(e => e.property);
    expect(properties).toContain('pharmacyId');
    expect(properties).toContain('lat');
    expect(properties).toContain('lng');
    expect(properties).toContain('deviceId');
    expect(properties).toContain('isOnDuty');
  });

  it('should fail if latitude is out of bounds', async () => {
    const dto = new SubmitReportDto();
    dto.pharmacyId = '12345';
    dto.lat = -100; // invalid min
    dto.lng = -65.2995;
    dto.deviceId = 'device-123';
    dto.isOnDuty = true;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('lat');
  });

  it('should fail if longitude is out of bounds', async () => {
    const dto = new SubmitReportDto();
    dto.pharmacyId = '12345';
    dto.lat = -24.1858;
    dto.lng = 200; // invalid max
    dto.deviceId = 'device-123';
    dto.isOnDuty = true;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('lng');
  });

  it('should fail if imageUrl is not a valid URL', async () => {
    const dto = new SubmitReportDto();
    dto.pharmacyId = '12345';
    dto.lat = -24.1858;
    dto.lng = -65.2995;
    dto.deviceId = 'device-123';
    dto.isOnDuty = true;
    dto.imageUrl = 'not-a-url';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('imageUrl');
  });
});
