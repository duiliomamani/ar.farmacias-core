import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { TurnstileVerificationService } from './turnstile-verification.service';

describe('TurnstileVerificationService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('accepts a valid token only for the expected action and hostname', async () => {
    const values: Record<string, string> = {
      TURNSTILE_SECRET_KEY: 'secret',
      TURNSTILE_HOSTNAMES: 'farmaya.ar',
      NODE_ENV: 'production',
    };
    const service = new TurnstileVerificationService({ get: (key: string) => values[key] } as any);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, action: 'pharmacy_report', hostname: 'farmaya.ar' }),
    }) as any;

    await expect(service.assertValid('token', 'pharmacy_report', '127.0.0.1')).resolves.toBeUndefined();
  });

  it('rejects a token issued for another action', async () => {
    const values: Record<string, string> = {
      TURNSTILE_SECRET_KEY: 'secret',
      TURNSTILE_HOSTNAMES: 'farmaya.ar',
      NODE_ENV: 'production',
    };
    const service = new TurnstileVerificationService({ get: (key: string) => values[key] } as any);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, action: 'feedback', hostname: 'farmaya.ar' }),
    }) as any;

    await expect(service.assertValid('token', 'pharmacy_report', '127.0.0.1'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails closed in production when the secret is missing', async () => {
    const service = new TurnstileVerificationService({
      get: (key: string) => key === 'NODE_ENV' ? 'production' : undefined,
    } as any);

    await expect(service.assertValid('token', 'pharmacy_report', '127.0.0.1'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
