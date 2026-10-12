import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiRes, ApiResponseDto } from '../../application/dtos/api-response.dto';
import { PoliceStation, PoliceStationService } from '../../application/services/police-station.service';

@ApiTags('police-stations')
@Controller('api/police-stations')
export class PoliceStationController {
  constructor(private readonly policeStationService: PoliceStationService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener comisarías y edificios de seguridad de Jujuy (IDEJuy Dataset #150)' })
  @ApiResponse({ status: 200, description: 'Lista de comisarías y dependencias policiales' })
  async getAll(): Promise<ApiResponseDto<PoliceStation[]>> {
    const stations = await this.policeStationService.getAll();
    return ApiRes.success(stations);
  }
}
