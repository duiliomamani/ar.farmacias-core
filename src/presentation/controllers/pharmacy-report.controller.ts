import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SubmitPharmacyReportCommand } from '../../application/commands/submit-pharmacy-report.command';
import { SubmitReportDto } from '../../application/dtos/submit-report.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { ApiRes, ApiResponseDto } from '../../application/dtos/api-response.dto';

@ApiTags('reports')
@Controller('api/pharmacies/report')
export class PharmacyReportController {
  constructor(
    private readonly commandBus: CommandBus,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 1800000 } })
  @ApiOperation({ summary: 'Submit a community report for a pharmacy status' })
  @ApiResponse({ status: 201, description: 'Report successfully submitted' })
  async submitReport(@Body() dto: SubmitReportDto, @Req() req: any): Promise<ApiResponseDto<boolean>> {
    const { pharmacyId, lat, lng, deviceId, isOnDuty, imageUrl } = dto;

    // We can now associate the report with the logged user if needed
    const userId = req.user.userId;

    await this.commandBus.execute(
      new SubmitPharmacyReportCommand(pharmacyId, lat, lng, deviceId, isOnDuty, imageUrl, userId)
    );

    return ApiRes.success(true);
  }
}

