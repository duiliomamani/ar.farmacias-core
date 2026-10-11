import { Body, Controller, Headers, Ip, Options, Post, Req, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Model } from 'mongoose';
import { SubmitFeedbackDto } from '../../application/dtos/submit-feedback.dto';
import { ApiRes } from '../../application/dtos/api-response.dto';
import { Feedback, FeedbackDocument } from '../../infrastructure/database/schemas/feedback.schema';
import { TurnstileVerificationService } from '../../infrastructure/security/turnstile-verification.service';

@ApiTags('feedback')
@Controller('api/feedback')
export class FeedbackController {
  constructor(
    @InjectModel(Feedback.name) private readonly feedbackModel: Model<FeedbackDocument>,
    private readonly turnstileVerification: TurnstileVerificationService,
  ) {}

  private readonly counters = new Map<string, { count: number; expiresAt: number }>();
  private globalCounter = { count: 0, expiresAt: 0 };

  @Options()
  async preflight(@Headers('origin') origin?: string) {
    this.assertOrigin(origin, undefined);
    return ApiRes.success(true);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @ApiOperation({ summary: 'Submit user feedback' })
  async submit(@Body() dto: SubmitFeedbackDto, @Req() request: any, @Ip() ip: string, @Headers('origin') origin?: string, @Headers('referer') referer?: string) {
    this.assertOrigin(origin, referer);
    if (!this.consumeRateLimit(ip || 'unknown')) {
      throw new HttpException('Demasiados mensajes. Probá nuevamente más tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (dto.website) return ApiRes.success(true);

    if (this.turnstileVerification.isConfigured()) {
      await this.turnstileVerification.assertValid(dto.turnstileToken, 'feedback', ip || 'unknown');
    }

    await this.feedbackModel.create({
      topic: dto.topic,
      message: dto.message.trim(),
      page: dto.page,
      pharmacyId: dto.pharmacyId,
    });

    await this.notifyTelegram(dto, request?.headers?.referer);
    return ApiRes.success(true);
  }

  private assertOrigin(origin?: string, referer?: string): void {
    const configured = (process.env.FRONTEND_URL || '')
      .split(',').map((value) => value.trim().replace(/\/$/, '')).filter(Boolean);
    const development = process.env.NODE_ENV !== 'production'
      ? ['http://localhost:3000', 'http://127.0.0.1:3000']
      : [];
    const allowed = new Set([...configured, ...development]);
    const candidate = origin || (referer ? this.originFromReferer(referer) : undefined);
    if (!candidate || !allowed.has(candidate)) throw new ForbiddenException('Origen no autorizado.');
  }

  private originFromReferer(referer: string): string | undefined {
    try { return new URL(referer).origin; } catch { return undefined; }
  }

  private consumeRateLimit(ip: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;
    const maxPerIp = 5;
    const maxGlobal = 40;
    if (this.globalCounter.expiresAt <= now) this.globalCounter = { count: 0, expiresAt: now + windowMs };
    const current = this.counters.get(ip);
    const counter = !current || current.expiresAt <= now ? { count: 0, expiresAt: now + windowMs } : current;
    if (counter.count >= maxPerIp || this.globalCounter.count >= maxGlobal) return false;
    counter.count += 1;
    this.globalCounter.count += 1;
    this.counters.set(ip, counter);
    return true;
  }

  private async notifyTelegram(dto: SubmitFeedbackDto, page?: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.FEEDBACK_CHAT_ID?.trim();
    if (!token || !chatId) return;
    const labels = { problem: 'Problema', suggestion: 'Sugerencia', comment: 'Comentario' };
    const text = `🟢 <b>Nuevo feedback de FarmaYa AR</b>\n\n<b>Tipo:</b> ${labels[dto.topic]}\n<b>Mensaje:</b> ${this.escapeHtml(dto.message)}\n<b>Página:</b> ${this.escapeHtml(dto.page || page || '/')}`;
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!response.ok) throw new HttpException('No se pudo entregar el feedback.', HttpStatus.BAD_GATEWAY);
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
