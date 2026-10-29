import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateOfficeDto {
  @ApiProperty({ example: 'Bangalore Tech Park Campus' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'SB-BLR-01' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 'Manyata Tech Park, Bangalore' })
  @IsNotEmpty()
  @IsString()
  address: string;

  @ApiProperty({ example: 13.0498300, description: 'Latitude coordinate' })
  @IsNotEmpty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 77.6202400, description: 'Longitude coordinate' })
  @IsNotEmpty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({
    default: 50,
    example: 50,
    description: 'Geofence radius in meters (Default: 50m)',
  })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(5000)
  radiusMeters?: number = 50;

  @ApiProperty({ required: false, default: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string = 'Asia/Kolkata';

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  attendanceValidationEnabled?: boolean;

  @ApiProperty({ required: false, description: 'Target Company ID (for Super Admin)' })
  @IsOptional()
  @IsString()
  companyId?: string;
}

export class UpdateOfficeGeofenceDto {
  @ApiProperty({ required: false, example: 'Bangalore Campus' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false, example: 13.0498300 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ required: false, example: 77.6202400 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ example: 75, description: 'Updated radius in meters' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(5000)
  radiusMeters?: number;

  @ApiProperty({
    example: 'Office boundary expanded to cover new adjacent wing',
    description: 'Mandatory reason for modifying geofence parameters',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  attendanceValidationEnabled?: boolean;
}

export class TestGeofenceDistanceDto {
  @ApiProperty({ example: 'office-id' })
  @IsNotEmpty()
  @IsString()
  officeId: string;

  @ApiProperty({ example: 13.0498350 })
  @IsNotEmpty()
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 77.6202420 })
  @IsNotEmpty()
  @IsNumber()
  longitude: number;
}
