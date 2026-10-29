import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { GeofenceValidationStatus } from '@prisma/client';

@ApiTags('Reports & Analytics')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard-summary')
  @ApiOperation({ summary: 'Get HR dashboard overview metrics & cards' })
  getDashboardSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.reportsService.getDashboardSummary(user, companyId);
  }

  @Get('geofence-validation')
  @ApiOperation({
    summary:
      'Report on employee geofence validation events (valid, rejected, suspicious GPS)',
  })
  getGeofenceReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('status') status?: GeofenceValidationStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getGeofenceValidationReport(user, {
      companyId,
      status,
      startDate,
      endDate,
    });
  }

  @Get('headcount')
  @ApiOperation({ summary: 'Get employee headcount grouped by department' })
  getHeadcount(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.reportsService.getHeadcountReport(user, companyId);
  }

  @Get('attendance-csv')
  @ApiOperation({ summary: 'Export daily attendance log as CSV file' })
  async exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date: string,
    @Query('companyId') companyId: string,
    @Res() res: Response,
  ) {
    const csvData = await this.reportsService.exportAttendanceCsv(user, {
      date: date || new Date().toISOString().split('T')[0],
      companyId,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-${date || 'today'}.csv"`,
    );
    res.send(csvData);
  }
}
