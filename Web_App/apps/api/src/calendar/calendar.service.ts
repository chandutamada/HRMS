import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async getCalendarData(
    user: AuthenticatedUser,
    params: {
      type: 'Holidays' | 'Payslips' | 'Attendance' | 'Office Timing';
      year: number;
      month: number;
      companyId?: string;
    },
  ) {
    const targetCompanyId = user.isSuperAdmin
      ? params.companyId || user.companyId
      : user.companyId;

    const startDate = new Date(params.year, params.month - 1, 1);
    const endDate = new Date(params.year, params.month, 0);

    switch (params.type) {
      case 'Holidays': {
        const holidays = await this.prisma.holiday.findMany({
          where: {
            companyId: targetCompanyId || undefined,
            date: { gte: startDate, lte: endDate },
          },
          orderBy: { date: 'asc' },
        });
        return { type: 'Holidays', items: holidays };
      }

      case 'Payslips': {
        if (!user.employeeId) {
          return { type: 'Payslips', items: [] };
        }
        const payslips = await this.prisma.payrollRecord.findMany({
          where: {
            employeeId: user.employeeId,
            payrollPeriod: {
              year: params.year,
              month: params.month,
            },
            payslipGenerated: true,
          },
          include: { payrollPeriod: true },
        });
        return { type: 'Payslips', items: payslips };
      }

      case 'Attendance': {
        if (!user.employeeId) {
          return { type: 'Attendance', items: [] };
        }
        const attendance = await this.prisma.attendanceRecord.findMany({
          where: {
            employeeId: user.employeeId,
            date: { gte: startDate, lte: endDate },
          },
          orderBy: { date: 'asc' },
        });
        return { type: 'Attendance', items: attendance };
      }

      case 'Office Timing': {
        const shift = await this.prisma.shift.findFirst({
          where: {
            companyId: targetCompanyId || undefined,
            isDefault: true,
          },
        });
        return {
          type: 'Office Timing',
          timing: shift || {
            startTime: '09:00',
            endTime: '17:30',
            lunchStartTime: '13:00',
            lunchEndTime: '14:00',
            gracePeriodMinutes: 30,
          },
        };
      }

      default:
        throw new BadRequestException('Invalid calendar type selected');
    }
  }

  async getHolidays(user: AuthenticatedUser, year?: number, companyId?: string) {
    const targetCompanyId = user.isSuperAdmin ? companyId || user.companyId : user.companyId;
    const targetYear = year || new Date().getFullYear();

    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear, 11, 31);

    return this.prisma.holiday.findMany({
      where: {
        companyId: targetCompanyId || undefined,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });
  }
}
