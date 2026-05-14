import { IsNotEmpty, IsNumber, IsString, IsBoolean, IsOptional, IsUrl, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitReportDto {
  @ApiProperty({ description: 'The unique ID of the pharmacy being reported' })
  @IsString()
  @IsNotEmpty()
  pharmacyId!: string;

  @ApiProperty({ description: 'Current latitude of the user reporting', minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ description: 'Current longitude of the user reporting', minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiProperty({ description: 'Unique device identifier of the user' })
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @ApiProperty({ description: 'Whether the pharmacy is actually on duty' })
  @IsBoolean()
  isOnDuty!: boolean;

  @ApiPropertyOptional({ description: 'Visual proof (photo) of the pharmacy status' })
  @IsOptional()
  @IsUrl()
  @IsString()
  imageUrl?: string;
}
