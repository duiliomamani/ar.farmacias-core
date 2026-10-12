import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiRes, ApiResponseDto } from '../../application/dtos/api-response.dto';
import { FireStation, FireStationService } from '../../application/services/fire-station.service';

@ApiTags('fire-stations')
@Controller('api/fire-stations')
export class FireStationController {
  constructor(private readonly fireStationService: FireStationService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener cuarteles de bomberos de Jujuy (IDEJuy Dataset #151)' })
  @ApiResponse({ status: 200, description: 'Lista de cuarteles de bomberos' })
  async getAll(): Promise<ApiResponseDto<FireStation[]>> {
    const stations = await this.fireStationService.getAll();
    return ApiRes.success(stations);
  }
}

