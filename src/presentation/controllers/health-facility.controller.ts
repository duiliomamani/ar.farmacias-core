import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiRes, ApiResponseDto } from '../../application/dtos/api-response.dto';
import { HealthFacility, HealthFacilityService } from '../../application/services/health-facility.service';

@ApiTags('health-facilities')
@Controller('api/health-facilities')
export class HealthFacilityController {
  constructor(private readonly healthFacilityService: HealthFacilityService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener efectores de salud unificados de Jujuy (Nodos, CAPS, CIC, Puestos)' })
  @ApiResponse({ status: 200, description: 'Lista unificada de efectores de salud' })
  async getAll(@Query('dataset') dataset?: string): Promise<ApiResponseDto<HealthFacility[]>> {
    const facilities = await this.healthFacilityService.getAll();
    if (dataset && dataset !== 'all') {
      const filtered = facilities.filter(
        (f) => String(f.datasetId) === dataset || f.type.toLowerCase() === dataset.toLowerCase(),
      );
      return ApiRes.success(filtered);
    }
    return ApiRes.success(facilities);
  }
}

