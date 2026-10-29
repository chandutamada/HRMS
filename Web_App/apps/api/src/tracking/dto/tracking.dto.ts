import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkLocationType } from '@prisma/client';

export class UpdateLiveLocationDto {
  @ApiProperty({ example: 12.9716, description: 'Current device GPS latitude' })
  @IsNotEmpty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 77.5946, description: 'Current device GPS longitude' })
  @IsNotEmpty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({ required: false, example: 5.2, description: 'GPS accuracy in meters' })
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiProperty({ required: false, example: 920.5, description: 'Altitude in meters' })
  @IsOptional()
  @IsNumber()
  altitude?: number;

  @ApiProperty({ required: false, example: 1.4, description: 'Speed in m/s' })
  @IsOptional()
  @IsNumber()
  speed?: number;

  @ApiProperty({ required: false, example: 180.0, description: 'Heading in degrees' })
  @IsOptional()
  @IsNumber()
  heading?: number;

  @ApiProperty({ required: false, example: true, description: 'Whether the employee is moving' })
  @IsOptional()
  @IsBoolean()
  isMoving?: boolean;

  @ApiProperty({ required: false, example: 88, description: 'Device battery percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  batteryLevel?: number;
}

export class RoutePointDto {
  @ApiProperty({ example: 12.9716 })
  @IsNotEmpty()
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 77.5946 })
  @IsNotEmpty()
  @IsNumber()
  lng: number;

  @ApiProperty({ required: false, example: 920.0 })
  @IsOptional()
  @IsNumber()
  alt?: number;

  @ApiProperty({ required: false, example: 12.5 })
  @IsOptional()
  @IsNumber()
  speed?: number;

  @ApiProperty({ required: false, example: 4.0 })
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiProperty({ example: 1729350000000, description: 'Epoch millisecond timestamp or ISO date' })
  @IsNotEmpty()
  ts: number | string;
}

export class CheckpointDto {
  @ApiProperty({ example: 12.9720 })
  @IsNotEmpty()
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 77.5950 })
  @IsNotEmpty()
  @IsNumber()
  lng: number;

  @ApiProperty({ example: 1729350300000, description: 'Arrival epoch millisecond or ISO date' })
  @IsNotEmpty()
  arrivedAt: number | string;

  @ApiProperty({ required: false, example: 1729350600000, description: 'Departure epoch millisecond or ISO date' })
  @IsOptional()
  departedAt?: number | string;

  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @IsNumber()
  index?: number;

  @ApiProperty({ required: false, example: 'Client Site Inspection Point' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SessionSyncRequestDto {
  @ApiProperty({ example: 'session-uuid-1234', description: 'Unique session identifier' })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiProperty({ example: 1729350000000, description: 'Session start epoch millisecond or ISO date' })
  @IsNotEmpty()
  startTime: number | string;

  @ApiProperty({ required: false, example: 1729357200000, description: 'Session end epoch millisecond or ISO date' })
  @IsOptional()
  endTime?: number | string;

  @ApiProperty({ required: false, example: 4.82, description: 'Total distance in kilometers' })
  @IsOptional()
  @IsNumber()
  distanceKm?: number;

  @ApiProperty({ required: false, example: 'Electronic City Phase 1' })
  @IsOptional()
  @IsString()
  areaName?: string;

  @ApiProperty({ required: false, example: 'Karnataka' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ type: [RoutePointDto], description: 'Recorded GPS route points' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  routePoints: RoutePointDto[];

  @ApiProperty({ type: [CheckpointDto], description: 'Detected stationary checkpoints/stops' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckpointDto)
  checkpoints: CheckpointDto[];
}

export class ToggleWorkLocationDto {
  @ApiProperty({ enum: WorkLocationType, example: WorkLocationType.OFF_SITE })
  @IsNotEmpty()
  @IsEnum(WorkLocationType)
  workLocationType: WorkLocationType;
}
