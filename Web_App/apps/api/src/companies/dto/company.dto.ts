import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { CompanyStatus } from '@prisma/client';

export class CreateCompanyDto {
  @ApiProperty({ example: 'SUPERBEE' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 'Superbee Innovations Private Limited' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ required: false, example: 'Superbee Innovations Pvt. Ltd.' })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiProperty({ required: false, example: 'contact@superbee.internal' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: '+91 80 4123 4567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: 'Manyata Tech Park, Bangalore' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false, enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;
}

export class UpdateCompanyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false, enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;
}
