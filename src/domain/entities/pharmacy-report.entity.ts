import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PharmacyReport {
  @ApiProperty()
  id?: string;

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
