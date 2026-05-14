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
    const utcDate = date 
      ? (date.includes('T') ? new Date(date) : new Date(`${date}T00:00:00Z`)) 
      : undefined;
    
    const data = await this.queryBus.execute(new GetNearbyPharmaciesQuery(lat, lng, radius || 5000, utcDate));
    return ApiRes.success(data);
  }

  @Get('by-date')
  @ApiOperation({ summary: 'Get all pharmacies on duty for a specific date' })
  @ApiResponse({ status: 200, description: 'List of pharmacies found', type: [Pharmacy] })
  async getByDate(@Query() dto: GetPharmaciesByDateDto): Promise<ApiResponseDto<Pharmacy[]>> {
    const { date, city } = dto;
    // If date is YYYY-MM-DD, append T00:00:00Z to force UTC midnight and avoid local timezone shifts
    const utcDate = date.includes('T') ? new Date(date) : new Date(`${date}T00:00:00Z`);
    
    const data = await this.queryBus.execute(new GetPharmaciesByDateQuery(utcDate, city));
    return ApiRes.success(data);
  }
}
