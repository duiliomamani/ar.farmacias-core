import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetNearbyPharmaciesQuery } from '../../application/queries/get-nearby-pharmacies.query';
import { GetPharmaciesByDateQuery } from '../../application/queries/get-pharmacies-by-date.query';
import { Pharmacy } from '../../domain/entities/pharmacy.entity';
import { GetNearbyPharmaciesDto } from '../../application/dtos/get-nearby-pharmacies.dto';
import { GetPharmaciesByDateDto } from '../../application/dtos/get-pharmacies-by-date.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiRes, ApiResponseDto } from '../../application/dtos/api-response.dto';

@ApiTags('pharmacies')
@Controller('api/pharmacies')
export class PharmacyController {
  constructor(
    private readonly queryBus: QueryBus,
  ) {}

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby pharmacies on duty' })
  @ApiResponse({ status: 200, description: 'List of pharmacies found', type: [Pharmacy] })
  async getNearby(@Query() dto: GetNearbyPharmaciesDto): Promise<ApiResponseDto<Pharmacy[]>> {
    const { lat, lng, radius, date } = dto;
    const parsedDate = this.parseDate(date);
    
    const data = await this.queryBus.execute(new GetNearbyPharmaciesQuery(lat, lng, radius || 5000, parsedDate));
    return ApiRes.success(data);
  }

  @Get('by-date')
  @ApiOperation({ summary: 'Get all pharmacies on duty for a specific date' })
  @ApiResponse({ status: 200, description: 'List of pharmacies found', type: [Pharmacy] })
  async getByDate(@Query() dto: GetPharmaciesByDateDto): Promise<ApiResponseDto<Pharmacy[]>> {
    const { date, city } = dto;
    const parsedDate = this.parseDate(date) || new Date();
    
    const data = await this.queryBus.execute(new GetPharmaciesByDateQuery(parsedDate, city));
    return ApiRes.success(data);
  }

  private parseDate(dateStr?: string): Date | undefined {
    if (!dateStr) return undefined;

    // Handle DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(dateStr);
    if (ddmmyyyy) {
      const [_, day, month, year] = ddmmyyyy;
      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
    }

    // Handle YYYY-MM-DD
    const yyyymmdd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(dateStr);
    if (yyyymmdd && !dateStr.includes('T')) {
      return new Date(`${dateStr}T00:00:00Z`);
    }

    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date;
  }
}
