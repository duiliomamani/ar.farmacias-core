import { Body, Controller, ForbiddenException, Headers, Ip, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubmitCommunityReportDto } from '../../application/dtos/submit-community-report.dto';
import { ApiRes } from '../../application/dtos/api-response.dto';
import { CommunityReportService } from '../../application/services/community-report.service';
import { TurnstileVerificationService } from '../../infrastructure/security/turnstile-verification.service';

@ApiTags('reports')
@Controller('api/pharmacies')
export class CommunityReportController {
  constructor(
    private readonly communityReportService: CommunityReportService,
    private readonly turnstileVerification: TurnstileVerificationService,
  ) {}

  @Post(':id/community-reports')
  @Throttle({ default: { limit: 6, ttl: 60 * 60 * 1000 } })
  @ApiOperation({ summary: 'Report whether a voluntary pharmacy is attending now' })
  async submit(
    @Param('id') pharmacyId: string,
    @Body() dto: SubmitCommunityReportDto,
    @Ip() ip: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    this.assertOrigin(origin, referer);
    await this.turnstileVerification.assertValid(dto.turnstileToken, 'pharmacy_report', ip || 'unknown');
    const result = await this.communityReportService.submit(
      pharmacyId,
      dto.lat,
      dto.lng,
      dto.deviceId,
      dto.isOpen,
    );
    return ApiRes.success(result);
  }

  private assertOrigin(origin?: string, referer?: string): void {
    const configured = (process.env.FRONTEND_URL || '')
      .split(',').map((value) => value.trim().replace(/\/$/, '')).filter(Boolean);
    const development = process.env.NODE_ENV !== 'production'
      ? ['http://localhost:3000', 'http://127.0.0.1:3000']
      : [];
    const allowed = new Set([...configured, ...development]);
    let candidate = origin;
    if (!candidate && referer) {
      try { candidate = new URL(referer).origin; } catch { candidate = undefined; }
    }
    if (!candidate || !allowed.has(candidate)) throw new ForbiddenException('Origen no autorizado.');
  }
}
