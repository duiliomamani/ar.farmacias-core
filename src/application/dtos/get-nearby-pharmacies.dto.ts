import { IsNumber, IsOptional, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetNearbyPharmaciesDto {
  @ApiProperty({ description: 'Latitude to search around', minimum: -90, maximum: 90 })
  @IsNumber()
  @Type(() => Number)
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ description: 'Longitude to search around', minimum: -180, maximum: 180 })
  @IsNumber()
  @Type(() => Number)
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({ description: 'Radius in meters for the search', default: 5000, minimum: 0, maximum: 50000 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(50000)
  radius?: number = 5000;

  @ApiPropertyOptional({ description: 'Date to filter pharmacies by (ISO format). Defaults to current time.', example: '2026-05-13' })
  @IsOptional()
  @IsString()
  date?: string;
}
