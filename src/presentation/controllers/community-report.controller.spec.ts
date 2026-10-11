import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommunityReportService } from '../../application/services/community-report.service';
import { TurnstileVerificationService } from '../../infrastructure/security/turnstile-verification.service';
import { CommunityReportController } from './community-report.controller';

describe('CommunityReportController', () => {
  let controller: CommunityReportController;
  const communityReportService = { submit: jest.fn() };
  const turnstileVerification = { assertValid: jest.fn() };
  const previousFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = 'https://farmaya.example';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityReportController],
      providers: [
        { provide: CommunityReportService, useValue: communityReportService },
        { provide: TurnstileVerificationService, useValue: turnstileVerification },
      ],
    }).compile();

    controller = module.get(CommunityReportController);
  });

  afterAll(() => {
    if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousFrontendUrl;
  });

  it('validates the captcha before recording an allowed-origin report', async () => {
    turnstileVerification.assertValid.mockResolvedValue(undefined);
    communityReportService.submit.mockResolvedValue({ accepted: true });
    const dto = {
      isOpen: true,
      lat: -24.185,
      lng: -65.299,
      deviceId: 'device-identifier-with-enough-length',
      turnstileToken: 'turnstile-token',
    };

    const result = await controller.submit(
      '507f1f77bcf86cd799439011',
      dto,
      '203.0.113.1',
      'https://farmaya.example',
    );

    expect(turnstileVerification.assertValid).toHaveBeenCalledWith(
      'turnstile-token',
      'pharmacy_report',
      '203.0.113.1',
    );
    expect(communityReportService.submit).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      dto.lat,
      dto.lng,
      dto.deviceId,
      true,
    );
    expect(result).toEqual({ data: { accepted: true }, isSuccessful: true, errors: [] });
  });

  it('rejects an untrusted origin before captcha verification', async () => {
    await expect(controller.submit(
      '507f1f77bcf86cd799439011',
      {
        isOpen: false,
        lat: -24.185,
        lng: -65.299,
        deviceId: 'device-identifier-with-enough-length',
        turnstileToken: 'turnstile-token',
      },
      '203.0.113.1',
      'https://malicious.example',
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(turnstileVerification.assertValid).not.toHaveBeenCalled();
    expect(communityReportService.submit).not.toHaveBeenCalled();
  });
});
