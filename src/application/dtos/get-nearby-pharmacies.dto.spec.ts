import { validate } from 'class-validator';
import { GetNearbyPharmaciesDto } from './get-nearby-pharmacies.dto';

describe('GetNearbyPharmaciesDto', () => {
  it('should validate a correct DTO', async () => {
    const dto = new GetNearbyPharmaciesDto();
    dto.lat = -24.1858;
    dto.lng = -65.2995;
    dto.radius = 10000;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate a correct DTO without optional radius', async () => {
    const dto = new GetNearbyPharmaciesDto();
    dto.lat = -24.1858;
    dto.lng = -65.2995;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail if latitude is missing', async () => {
    const dto = new GetNearbyPharmaciesDto();
    dto.lng = -65.2995;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('lat');
  });

  it('should fail if latitude is out of bounds', async () => {
    const dto = new GetNearbyPharmaciesDto();
    dto.lat = 95; // > 90
    dto.lng = -65.2995;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('lat');
  });

  it('should fail if longitude is out of bounds', async () => {
    const dto = new GetNearbyPharmaciesDto();
    dto.lat = -24.1858;
    dto.lng = -200; // < -180

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('lng');
  });

  it('should fail if radius is out of bounds', async () => {
    const dto = new GetNearbyPharmaciesDto();
    dto.lat = -24.1858;
    dto.lng = -65.2995;
    dto.radius = 60000; // > 50000

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('radius');
  });
});
