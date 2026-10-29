import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'superadmin@hrms.internal',
    description: 'Email or Employee Code (e.g. SB-001 or superadmin@hrms.internal)',
  })
  @IsNotEmpty()
  @IsString()
  identifier: string;

  @ApiProperty({ example: 'Admin@123456', description: 'User account password' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ required: false, example: 'SUPERBEE', description: 'Optional Company Code' })
  @IsOptional()
  @IsString()
  companyCode?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Secure refresh token' })
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: 'New password (min 8 chars)' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class GoogleLoginDto {
  @ApiProperty({
    required: false,
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
    description: 'Google ID token from Google Sign-In client',
  })
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiProperty({
    required: false,
    example: 'employee@gramtarang.org',
    description: 'Google authenticated email address',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false, description: 'Google sub / unique user id' })
  @IsOptional()
  @IsString()
  googleId?: string;

  @ApiProperty({ required: false, description: 'Google display name' })
  @IsOptional()
  @IsString()
  displayName?: string;
}
