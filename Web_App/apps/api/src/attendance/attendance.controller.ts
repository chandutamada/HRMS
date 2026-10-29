import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import {
  RecordAttendanceEventDto,
  RequestCorrectionDto,
  ReviewCorrectionDto,
  ManualAttendanceOverrideDto,
} from './dto/attendance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Attendance & Geofencing')
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('event')
  @ApiOperation({
    summary:
      'Record geofenced check-in or check-out (Validated using backend Haversine calculation against 50m office radius)',
  })
  recordEvent(
    @Body() dto: RecordAttendanceEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.recordAttendanceEvent(dto, user);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get current day attendance status for employee mobile app' })
  getToday(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.getTodayStatus(user);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get attendance history with filtering and pagination' })
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('employeeId') employeeId?: string,
    @Query('companyId') companyId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.attendanceService.getAttendanceHistory(user, {
      employeeId,
      companyId,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Post('corrections/request')
  @ApiOperation({ summary: 'Employee submits an attendance correction request' })
  requestCorrection(
    @Body() dto: RequestCorrectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.requestCorrection(dto, user);
  }

  @Get('corrections/my')
  @ApiOperation({ summary: 'List attendance correction requests submitted by the logged in employee' })
  getMyCorrections(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.getMyCorrections(user);
  }

  @Get('corrections/pending')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'List pending attendance correction requests (HR view)' })
  getPendingCorrections(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.getPendingCorrections(user);
  }

  @Put('corrections/:id/review')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Approve or reject attendance correction request' })
  reviewCorrection(
    @Param('id') id: string,
    @Body() dto: ReviewCorrectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.reviewCorrection(id, dto, user);
  }

  @Post('manual-override')
  @Roles('SUPER_ADMIN', 'HR_ADMIN')
  @ApiOperation({
    summary:
      'Manual attendance entry or override by HR (Mandatory reason required, creates audit record)',
  })
  manualOverride(
    @Body() dto: ManualAttendanceOverrideDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.manualOverride(dto, user);
  }

  @Get('inout')
  @ApiOperation({ summary: 'Get employee In/Out report for a specific date' })
  getInOutReport(
    @Query('report_date') reportDate: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getInOutReport(reportDate, user);
  }

  @Get('daily')
  @ApiOperation({ summary: 'Get daily attendance report with check-in/out times' })
  getDailyReport(
    @Query('report_date') reportDate: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getDailyReport(reportDate, user);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Get monthly attendance summary per employee' })
  getMonthlyReport(
    @Query('month') month: string,
    @Query('year') year: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.attendanceService.getMonthlyReport(m, y, user);
  }
}
