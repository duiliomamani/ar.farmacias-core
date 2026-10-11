import { validate } from 'class-validator';
import { SubmitCommunityReportDto } from './submit-community-report.dto';

describe('SubmitCommunityReportDto', () => {
  it('accepts a valid report', async () => {
    const dto = Object.assign(new SubmitCommunityReportDto(), {
      isOpen: true,
      lat: -24.18,
      lng: -65.30,
      deviceId: 'device-id',
      turnstileToken: 'token',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects missing captcha and invalid coordinates', async () => {
    const dto = Object.assign(new SubmitCommunityReportDto(), {
      isOpen: true,
      lat: 120,
      lng: -200,
      deviceId: 'device-id',
      turnstileToken: '',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['lat', 'lng', 'turnstileToken']));
  });
});
