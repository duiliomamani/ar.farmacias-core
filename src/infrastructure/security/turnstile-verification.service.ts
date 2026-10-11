import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TurnstileVerificationService {
  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>('TURNSTILE_SECRET_KEY')?.trim());
  }

  async assertValid(token: string | undefined, action: string, remoteIp: string): Promise<void> {
    const secret = this.configService.get<string>('TURNSTILE_SECRET_KEY')?.trim();
    if (!secret) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw new ServiceUnavailableException('La verificación de seguridad no está configurada.');
      }
      return;
    }
    if (!token) throw new ForbiddenException('Completá la verificación de seguridad.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: new URLSearchParams({ secret, response: token, remoteip: remoteIp }),
        signal: controller.signal,
      });
      if (!response.ok) throw new ForbiddenException('No se pudo validar la verificación de seguridad.');

      const result = await response.json() as { success?: boolean; action?: string; hostname?: string };
      const configuredHostnames = (this.configService.get<string>('TURNSTILE_HOSTNAMES') || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      const allowedHostnames = configuredHostnames.length > 0
        ? configuredHostnames
        : this.configService.get<string>('NODE_ENV') !== 'production'
          ? ['localhost', '127.0.0.1']
          : [];
      const valid = result.success === true
        && result.action === action
        && Boolean(result.hostname)
        && allowedHostnames.includes(result.hostname!.toLowerCase());
      if (!valid) throw new ForbiddenException('No se pudo validar la verificación de seguridad.');
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ForbiddenException('No se pudo validar la verificación de seguridad.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
