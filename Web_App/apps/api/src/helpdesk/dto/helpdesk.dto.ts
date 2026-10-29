import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { TicketPriority, TicketStatus } from '@prisma/client';

export class CreateTicketDto {
  @ApiProperty({ example: 'ATTENDANCE', description: 'Category: ATTENDANCE, HR, IT, PAYROLL, GENERAL' })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty({ example: 'Geofence check-in issue at South Gate' })
  @IsNotEmpty()
  @IsString()
  subject: string;

  @ApiProperty({ example: 'When entering the premises, GPS showed outside geofence by 15m.' })
  @IsNotEmpty()
  @IsString()
  description: string;
}

export class AddTicketMessageDto {
  @ApiProperty({ example: 'We have updated the entrance coordinates. Please test again tomorrow.' })
  @IsNotEmpty()
  @IsString()
  message: string;
}

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: TicketStatus, example: TicketStatus.RESOLVED })
  @IsNotEmpty()
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @ApiProperty({ required: false, example: 'Resolved after checking device GPS settings' })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
