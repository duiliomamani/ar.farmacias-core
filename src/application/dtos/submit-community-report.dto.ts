import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';

export class SubmitCommunityReportDto {
  @ApiProperty({ description: 'Whether the voluntary pharmacy is attending now' })
  @IsBoolean()
  isOpen!: boolean;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiProperty({ description: 'Anonymous device identifier' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;

  @ApiProperty({ description: 'Single-use Cloudflare Turnstile token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  turnstileToken!: string;
}
