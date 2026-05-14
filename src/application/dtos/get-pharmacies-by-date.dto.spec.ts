import { validate } from 'class-validator';
import { GetPharmaciesByDateDto } from './get-pharmacies-by-date.dto';

describe('GetPharmaciesByDateDto', () => {
  it('should validate a correct DTO with only date', async () => {
    const dto = new GetPharmaciesByDateDto();
    dto.date = '2026-05-13';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate a correct DTO with date and city', async () => {
    const dto = new GetPharmaciesByDateDto();
    dto.date = '2026-05-13T00:00:00.000Z';
    dto.city = 'San Salvador de Jujuy';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail if date is missing', async () => {
    const dto = new GetPharmaciesByDateDto();
    
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('date');
  });

  it('should fail if date is not a valid ISO string', async () => {
    const dto = new GetPharmaciesByDateDto();
    dto.date = 'not-a-date';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('date');
  });
});
