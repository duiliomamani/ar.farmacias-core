import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiRes, ApiResponseDto } from '../../application/dtos/api-response.dto';
import { GeorefJujuyService, GeorefJujuyItem } from '../../application/services/georef-jujuy.service';

export interface GeorefJujuyResultDto {
  fuente: string;
  total: number;
  resultados: GeorefJujuyItem[];
}

@ApiTags('georef')
@Controller('api/georef')
export class GeorefController {
  constructor(private readonly georefJujuyService: GeorefJujuyService) {}

  @Get('jujuy')
  @ApiOperation({ summary: 'Búsqueda geográfica universal para Jujuy (Georef Nación + IDEJuy)' })
  @ApiResponse({ status: 200, description: 'Resultados geográficos normalizados' })
  async getJujuy(
    @Query('q') q?: string,
    @Query('tipo') tipo?: string,
    @Query('departamento') departamento?: string,
    @Query('max') max?: string,
  ): Promise<ApiResponseDto<GeorefJujuyResultDto>> {
    const maxNumber = max ? parseInt(max, 10) : 25;
    const result = await this.georefJujuyService.search(q, tipo, departamento, maxNumber);
    return ApiRes.success(result);
  }
}

