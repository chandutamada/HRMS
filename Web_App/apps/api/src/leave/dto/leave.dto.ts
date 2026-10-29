import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { HalfDayPeriod, LeaveStatus } from '@prisma/client';

export class ApplyLeaveDto {
  @ApiProperty({ example: 'leave-type-uuid' })
  @IsNotEmpty()
  @IsString()
  leaveTypeId: string;

  @ApiProperty({ example: '2026-10-20' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-10-21' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isHalfDay?: boolean;

  @ApiProperty({ required: false, enum: HalfDayPeriod })
  @IsOptional()
  @IsEnum(HalfDayPeriod)
  halfDayPeriod?: HalfDayPeriod;

  @ApiProperty({ example: 'Personal emergency / family function' })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({ required: false, example: '/uploads/medical_cert.pdf' })
  @IsOptional()
  @IsString()
  attachmentPath?: string;
}

export class CalculateLeavePreviewDto {
  @ApiProperty({ example: 'leave-type-uuid' })
  @IsNotEmpty()
  @IsString()
  leaveTypeId: string;

  @ApiProperty({ example: '2026-10-20' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-10-21' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isHalfDay?: boolean;
}

export class ReviewLeaveDto {
  @ApiProperty({ enum: LeaveStatus, example: LeaveStatus.APPROVED })
  @IsNotEmpty()
  @IsEnum(LeaveStatus)
  status: LeaveStatus;

  @ApiProperty({ required: false, example: 'Approved' })
  @IsOptional()
  @IsString()
  reviewRemarks?: string;
}

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'Paternity Leave' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'PL' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiProperty({ example: 5 })
  @IsNotEmpty()
  @IsNumber()
  annualEntitlement: number;

  @ApiProperty({ required: false, default: 5 })
  @IsOptional()
  @IsNumber()
  maxConsecutiveDays?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  requiresDocProof?: boolean;

  @ApiProperty({ required: false, description: 'Company ID (for Super Admin)' })
  @IsOptional()
  @IsString()
  companyId?: string;
}
