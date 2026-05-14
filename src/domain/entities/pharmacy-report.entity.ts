import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PharmacyReport {
  @ApiProperty()
  id?: string;

  @ApiProperty()
  pharmacyId!: string;

  @ApiProperty()
  deviceId!: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiProperty({
    example: { type: 'Point', coordinates: [-65.30, -24.18] },
  })
  userLocation!: {
    type: 'Point';
    coordinates: [number, number];
  };

  @ApiProperty()
  isOnDuty!: boolean;

  @ApiProperty()
  confidence!: number;

  @ApiProperty()
  source!: string;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiPropertyOptional()
  createdAt?: Date;

  constructor(partial: Partial<PharmacyReport>) {
    Object.assign(this, partial);
  }
}
