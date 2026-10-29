import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { CircularStatus } from '@prisma/client';

export class CreateCircularDto {
  @ApiProperty({ example: 'Annual Performance Appraisal Cycle 2026' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    example: 'All employees are requested to complete self-appraisals by end of month.',
  })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({
    example: ['SUPERBEE', 'GTIDS', 'GTIB'],
    description: 'Target company codes selected via checkboxes',
  })
  @IsNotEmpty()
  @IsArray()
  targetCompanyCodes: string[];

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  requiresAcknowledgement?: boolean;

  @ApiProperty({ enum: CircularStatus, default: CircularStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(CircularStatus)
  status?: CircularStatus;
}
