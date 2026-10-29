import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Calendar')
@Controller('calendar')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('view')
  @ApiOperation({
    summary:
      'Get calendar details by selection: Holidays, Payslips, Attendance, Office Timing',
  })
  getCalendarData(
    @CurrentUser() user: AuthenticatedUser,
    @Query('type') type: 'Holidays' | 'Payslips' | 'Attendance' | 'Office Timing',
    @Query('year') year: number,
    @Query('month') month: number,
    @Query('companyId') companyId?: string,
  ) {
    return this.calendarService.getCalendarData(user, {
      type: type || 'Holidays',
      year: year ? Number(year) : new Date().getFullYear(),
      month: month ? Number(month) : new Date().getMonth() + 1,
      companyId,
    });
  }

  @Get('holidays')
  @ApiOperation({ summary: 'List company holidays for year' })
  getHolidays(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year?: number,
    @Query('companyId') companyId?: string,
  ) {
    return this.calendarService.getHolidays(user, year ? Number(year) : undefined, companyId);
  }
}
