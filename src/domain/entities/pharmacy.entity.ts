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
  originalAddress!: string;

  @ApiProperty({
    example: { type: 'Point', coordinates: [-65.30, -24.18] },
  })
  location!: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };

  @ApiProperty()
  georef!: {
    provinciaId: string;
    municipioId: string;
    localidadId: string;
    streetName?: string;
    streetNumber?: string;
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
  isPermanentlyOnDuty?: boolean;

  @ApiPropertyOptional()
  isVoluntary?: boolean;

  @ApiPropertyOptional({ type: [PharmacyReport] })
  communityReports?: PharmacyReport[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  constructor(partial: Partial<Pharmacy>) {
    Object.assign(this, partial);
  }
}
