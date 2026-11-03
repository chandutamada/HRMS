import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsDateString,
  MinLength,
} from 'class-validator';
import { EmploymentStatus, Gender, WorkLocationType } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'SB-003' })
  @IsNotEmpty()
  @IsString()
  employeeCode: string;

  @ApiProperty({ example: 'Ananya' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Verma' })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'ananya.verma@superbee.internal' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false, example: '+91 9811223344' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, default: 'Password@123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiProperty({ required: false, enum: Gender, example: Gender.FEMALE })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ example: '2026-03-01' })
  @IsNotEmpty()
  @IsDateString()
  joiningDate: string;

  @ApiProperty({ required: false, example: '1996-05-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ required: false, enum: EmploymentStatus, default: EmploymentStatus.FULL_TIME })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiProperty({ required: false, enum: WorkLocationType })
  @IsOptional()
  @IsEnum(WorkLocationType)
  workLocationType?: WorkLocationType;

  @ApiProperty({ required: false, description: 'Department ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty({ required: false, description: 'Designation ID' })
  @IsOptional()
  @IsString()
  designationId?: string;

  @ApiProperty({ required: false, description: 'Designation Title (auto-creates if id omitted)' })
  @IsOptional()
  @IsString()
  designationTitle?: string;

  @ApiProperty({ required: false, description: 'Biometric / Device User ID' })
  @IsOptional()
  @IsString()
  deviceUserId?: string;

  @ApiProperty({ required: false, description: 'Office Location ID' })
  @IsOptional()
  @IsString()
  officeLocationId?: string;

  @ApiProperty({ required: false, description: 'Shift ID' })
  @IsOptional()
  @IsString()
  shiftId?: string;

  @ApiProperty({ required: false, description: 'Reporting Manager Employee ID' })
  @IsOptional()
  @IsString()
  reportingManagerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currentAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContactRelation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankIfscCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  panNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  uanNumber?: string;
}

export class UpdateEmployeeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @ApiProperty({ required: false, enum: WorkLocationType })
  @IsOptional()
  @IsEnum(WorkLocationType)
  workLocationType?: WorkLocationType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @ApiProperty({ required: false, enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  designationId?: string | null;

  @ApiProperty({ required: false, description: 'Designation Title (auto-creates if id omitted)' })
  @IsOptional()
  @IsString()
  designationTitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  officeLocationId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shiftId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reportingManagerId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currentAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContactRelation?: string;
}
