import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetPharmaciesByDateDto {
  @ApiProperty({
    description: 'Specific date to check (ISO 8601 format)',
    example: '2026-05-13',
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    description: 'Optional city to filter results',
    required: false,
    example: 'San Salvador de Jujuy',
  })
  @IsString()
  @IsOptional()
  city?: string;
}
