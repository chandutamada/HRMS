import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { AttendanceEventType, AttendanceStatus, CorrectionStatus } from '@prisma/client';

export class RecordAttendanceEventDto {
  @ApiProperty({ enum: AttendanceEventType, example: AttendanceEventType.CHECK_IN })
  @IsNotEmpty()
  @IsEnum(AttendanceEventType)
  eventType: AttendanceEventType;

  @ApiProperty({ example: 13.0498350, description: 'Device GPS Latitude' })
  @IsNotEmpty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 77.6202420, description: 'Device GPS Longitude' })
  @IsNotEmpty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({ example: 12.5, description: 'GPS Accuracy in meters' })
  @IsNotEmpty()
  @IsNumber()
  accuracyMeters: number;

  @ApiProperty({ required: false, example: 'Pixel 8 Pro' })
  @IsOptional()
  @IsString()
  deviceModel?: string;

  @ApiProperty({ required: false, example: 'Android 14' })
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isMocked?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ required: false, description: 'Base64 data URI or URL of captured face photo selfie' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiProperty({ required: false, example: 85, description: 'Device battery percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  batteryPercentage?: number;
}

export class RequestCorrectionDto {
  @ApiProperty({ example: '2026-10-15' })
  @IsNotEmpty()
  @IsDateString()
  requestDate: string;

  @ApiProperty({ required: false, example: '2026-10-15T09:15:00.000Z' })
  @IsOptional()
  @IsDateString()
  requestedCheckIn?: string;

  @ApiProperty({ required: false, example: '2026-10-15T17:35:00.000Z' })
  @IsOptional()
  @IsDateString()
  requestedCheckOut?: string;

  @ApiProperty({ example: 'Device GPS glitch at entrance gate' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class ReviewCorrectionDto {
  @ApiProperty({ enum: CorrectionStatus, example: CorrectionStatus.APPROVED })
  @IsNotEmpty()
  @IsEnum(CorrectionStatus)
  status: CorrectionStatus;

  @ApiProperty({ required: false, example: 'Approved after verification with team lead' })
  @IsOptional()
  @IsString()
  reviewRemarks?: string;
}

export class ManualAttendanceOverrideDto {
  @ApiProperty({ example: 'employee-uuid' })
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @ApiProperty({ example: '2026-10-15' })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({ enum: AttendanceStatus, example: AttendanceStatus.PRESENT })
  @IsNotEmpty()
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiProperty({ required: false, example: '2026-10-15T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  firstCheckIn?: string;

  @ApiProperty({ required: false, example: '2026-10-15T17:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  lastCheckOut?: string;

  @ApiProperty({ example: 'Client on-site meeting manual punch update' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
