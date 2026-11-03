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
    const targetCompanyId =
      params.companyId ||
      user.activeCompanyId ||
      (user.isSuperAdmin ? undefined : user.companyId);

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
    const targetCompanyId = companyId || user.activeCompanyId || (user.isSuperAdmin ? undefined : user.companyId);
    const targetYear = year || new Date().getFullYear();

    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear, 11, 31);

    const holidays = await this.prisma.holiday.findMany({
      where: {
        companyId: targetCompanyId || undefined,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    if (holidays.length > 0) {
      return holidays;
    }

    // Default standard calendar holidays for current year if none seeded in DB
    const standardHolidays = [
      { name: "New Year's Day", date: new Date(targetYear, 0, 1), isOptional: false },
      { name: 'Makar Sankranti / Pongal', date: new Date(targetYear, 0, 14), isOptional: false },
      { name: 'Republic Day', date: new Date(targetYear, 0, 26), isOptional: false },
      { name: 'Maha Shivratri', date: new Date(targetYear, 1, 16), isOptional: true },
      { name: 'Holi', date: new Date(targetYear, 2, 25), isOptional: false },
      { name: 'Ugadi / Gudi Padwa', date: new Date(targetYear, 3, 9), isOptional: false },
      { name: 'Eid al-Fitr', date: new Date(targetYear, 3, 11), isOptional: false },
      { name: 'May Day / Labour Day', date: new Date(targetYear, 4, 1), isOptional: false },
      { name: 'Independence Day', date: new Date(targetYear, 7, 15), isOptional: false },
      { name: 'Ganesh Chaturthi', date: new Date(targetYear, 8, 7), isOptional: false },
      { name: 'Gandhi Jayanti', date: new Date(targetYear, 9, 2), isOptional: false },
      { name: 'Dussehra / Vijayadashami', date: new Date(targetYear, 9, 21), isOptional: false },
      { name: 'Diwali / Deepavali', date: new Date(targetYear, 10, 8), isOptional: false },
      { name: 'Guru Nanak Jayanti', date: new Date(targetYear, 10, 24), isOptional: true },
      { name: 'Christmas Day', date: new Date(targetYear, 11, 25), isOptional: false },
    ];

    return standardHolidays.map((h, idx) => ({
      id: `default-holiday-${targetYear}-${idx}`,
      name: h.name,
      date: h.date,
      isOptional: h.isOptional,
      description: 'Official Recognized Holiday',
    }));
  }
}
