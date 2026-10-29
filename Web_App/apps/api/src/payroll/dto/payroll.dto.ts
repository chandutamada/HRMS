import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class ProcessPayrollDto {
  @ApiProperty({ example: 2026 })
  @IsNotEmpty()
  @IsNumber()
  year: number;

  @ApiProperty({ example: 10, description: 'Month (1-12)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ required: false, description: 'Target Company ID (for Super Admin)' })
  @IsOptional()
  @IsString()
  companyId?: string;
}

export class OverridePayrollItemDto {
  @ApiProperty({ example: 'payroll-record-uuid' })
  @IsNotEmpty()
  @IsString()
  recordId: string;

  @ApiProperty({ example: 85000 })
  @IsNotEmpty()
  @IsNumber()
  netSalary: number;

  @ApiProperty({ example: 'Approved special bonus adjustment by management' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class CreateSalaryStructureDto {
  @ApiProperty({ example: 'employee-uuid' })
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @ApiProperty({ example: 50000 })
  @IsNotEmpty()
  @IsNumber()
  basicSalary: number;

  @ApiProperty({ example: 20000 })
  @IsNotEmpty()
  @IsNumber()
  hra: number;

  @ApiProperty({ example: 1600 })
  @IsNotEmpty()
  @IsNumber()
  conveyance: number;

  @ApiProperty({ example: 13400 })
  @IsNotEmpty()
  @IsNumber()
  specialAllowance: number;

  @ApiProperty({ example: 6000 })
  @IsNotEmpty()
  @IsNumber()
  epfEmployee: number;

  @ApiProperty({ example: 200 })
  @IsNotEmpty()
  @IsNumber()
  professionalTax: number;
}

export class GenerateIndividualPayslipDto {
  @ApiProperty({ example: 'employee-uuid' })
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @ApiProperty({ example: 2026 })
  @IsNotEmpty()
  @IsNumber()
  year: number;

  @ApiProperty({ example: 10, description: 'Month (1-12)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ example: 31, required: false })
  @IsOptional()
  @IsNumber()
  totalDays?: number;

  @ApiProperty({ example: 30, required: false })
  @IsOptional()
  @IsNumber()
  paidDays?: number;

  @ApiProperty({ example: 50000 })
  @IsNotEmpty()
  @IsNumber()
  basicSalary: number;

  @ApiProperty({ example: 20000, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  hra?: number;

  @ApiProperty({ example: true, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  hraEnabled?: boolean;

  @ApiProperty({ example: 5000, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  da?: number;

  @ApiProperty({ example: true, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  daEnabled?: boolean;

  @ApiProperty({ example: 1250, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  medicalAllowance?: number;

  @ApiProperty({ example: true, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  medicalAllowanceEnabled?: boolean;

  @ApiProperty({ example: 3000, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  otherAllowance?: number;

  @ApiProperty({ example: true, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  otherAllowanceEnabled?: boolean;

  @ApiProperty({ example: 6000, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  epf?: number;

  @ApiProperty({ example: 200, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  professionalTax?: number;

  @ApiProperty({ example: 1500, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  tds?: number;

  @ApiProperty({ example: 2, required: false, default: 0, description: 'Number of unapproved leave days (Loss of Pay)' })
  @IsOptional()
  @IsNumber()
  lopDays?: number;

  @ApiProperty({ example: 4500, required: false, default: 0, description: 'Loss of Pay deduction amount' })
  @IsOptional()
  @IsNumber()
  lopAmount?: number;

  @ApiProperty({ example: false, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  finalize?: boolean;
}

export class BulkUploadPayrollRowDto {
  @ApiProperty({ example: 'EMP001' })
  @IsNotEmpty()
  @IsString()
  employeeCode: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ example: 50000 })
  @IsNotEmpty()
  @IsNumber()
  basicSalary: number;

  @ApiProperty({ example: 20000, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  hra?: number;

  @ApiProperty({ example: 1600, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  conveyance?: number;

  @ApiProperty({ example: 5000, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  da?: number;

  @ApiProperty({ example: 1250, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  medicalAllowance?: number;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  specialAllowance?: number;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  otherAllowances?: number;

  @ApiProperty({ example: 6000, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  epfEmployee?: number;

  @ApiProperty({ example: 200, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  professionalTax?: number;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  tds?: number;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  lopDays?: number;
}

export class BulkUploadPayrollDto {
  @ApiProperty({ example: 2026 })
  @IsNotEmpty()
  @IsNumber()
  year: number;

  @ApiProperty({ example: 10, description: 'Month (1-12)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ required: false, description: 'Target Company ID (for Super Admin)' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty({ type: [BulkUploadPayrollRowDto] })
  @IsNotEmpty()
  records: BulkUploadPayrollRowDto[];
}

export class FinalizeAllPayrollDto {
  @ApiProperty({ example: 2026 })
  @IsNotEmpty()
  @IsNumber()
  year: number;

  @ApiProperty({ example: 10, description: 'Month (1-12)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ required: false, description: 'Target Company ID (for Super Admin)' })
  @IsOptional()
  @IsString()
  companyId?: string;
}

