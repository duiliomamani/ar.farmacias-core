import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PharmacyReport } from './pharmacy-report.entity';

export class Pharmacy {
  @ApiProperty()
  id?: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiProperty()
  address!: string;

  @ApiProperty({
    example: { type: 'Point', coordinates: [-65.30, -24.18] },
  })
  location!: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };

  @ApiProperty()
  isOnDuty!: boolean;

  @ApiPropertyOptional()
  dutyFrom?: Date;

  @ApiPropertyOptional()
  dutyUntil?: Date;

  @ApiPropertyOptional()
  openingHours?: string;

  @ApiPropertyOptional()
  isVoluntary?: boolean;

  @ApiPropertyOptional({ description: 'Calculated trust score for the current status (0 to 1)' })
  statusConfidence?: number;

  @ApiPropertyOptional({ type: [PharmacyReport] })
  communityReports?: PharmacyReport[];

  constructor(partial: Partial<Pharmacy>) {
    Object.assign(this, partial);
  }
}
