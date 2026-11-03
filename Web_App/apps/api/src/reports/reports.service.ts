import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  AttendanceStatus,
  CorrectionStatus,
  LeaveStatus,
  GeofenceValidationStatus,
} from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * HR Dashboard Cards Summary
   */
  async getDashboardSummary(user: AuthenticatedUser, companyIdQuery?: string) {
    const targetCompanyId =
      companyIdQuery ||
      user.activeCompanyId ||
      (user.isSuperAdmin ? undefined : user.companyId);

    const companyWhere = targetCompanyId ? { companyId: targetCompanyId } : {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalEmployees,
      todayPresent,
      todayAbsent,
      todayOnLeave,
      todayLate,
      pendingCorrections,
      geofenceRejections,
      pendingLeaves,
      pendingHelpdesk,
    ] = await Promise.all([
      this.prisma.employee.count({
        where: {
          ...companyWhere,
          employmentStatus: { notIn: ['RESIGNED', 'TERMINATED'] },
        },
      }),
      this.prisma.attendanceRecord.count({
        where: {
          ...companyWhere,
          date: today,
          status: AttendanceStatus.PRESENT,
        },
      }),
      this.prisma.attendanceRecord.count({
        where: {
          ...companyWhere,
          date: today,
          status: AttendanceStatus.ABSENT,
        },
      }),
      this.prisma.attendanceRecord.count({
        where: {
          ...companyWhere,
          date: today,
          status: AttendanceStatus.ON_LEAVE,
        },
      }),
      this.prisma.attendanceRecord.count({
        where: {
          ...companyWhere,
          date: today,
          isLate: true,
        },
      }),
      this.prisma.attendanceCorrectionRequest.count({
        where: {
          ...companyWhere,
          status: CorrectionStatus.PENDING,
        },
      }),
      this.prisma.attendanceEvent.count({
        where: {
          timestamp: { gte: today, lt: tomorrow },
          validationStatus: {
            in: [
              GeofenceValidationStatus.OUTSIDE_GEOFENCE,
              GeofenceValidationStatus.INACCURATE_GPS,
              GeofenceValidationStatus.MOCKED_LOCATION,
              GeofenceValidationStatus.SUSPICIOUS,
            ],
          },
          ...(targetCompanyId
            ? { employee: { companyId: targetCompanyId } }
            : {}),
        },
      }),
      this.prisma.leaveApplication.count({
        where: {
          ...companyWhere,
          status: LeaveStatus.PENDING,
        },
      }),
      this.prisma.helpdeskTicket.count({
        where: {
          ...companyWhere,
          status: 'OPEN',
        },
      }).catch(() => 0),
    ]);

    return {
      totalEmployees,
      presentToday: todayPresent,
      absentToday: todayAbsent,
      onLeaveToday: todayOnLeave,
      lateArrivalsToday: todayLate,
      pendingCorrections,
      geofenceRejections,
      pendingLeaves,
      pendingHelpdesk: Number(pendingHelpdesk) || 0,
    };
  }

  /**
   * Geofence Validation Logs Report
   */
  async getGeofenceValidationReport(
    user: AuthenticatedUser,
    params: {
      companyId?: string;
      startDate?: string;
      endDate?: string;
      status?: GeofenceValidationStatus;
    },
  ) {
    const targetCompanyId =
      params.companyId ||
      user.activeCompanyId ||
      (user.isSuperAdmin ? undefined : user.companyId);

    const where: any = {};
    if (targetCompanyId) {
      where.employee = { companyId: targetCompanyId };
    }
    if (params.status) {
      where.validationStatus = params.status;
    }
    if (params.startDate && params.endDate) {
      where.timestamp = {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate),
      };
    }

    const events = await this.prisma.attendanceEvent.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            company: { select: { code: true, name: true } },
          },
        },
        officeLocation: {
          select: { name: true, radiusMeters: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    return events.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
      employeeCode: e.employee.employeeCode,
      companyCode: e.employee.company.code,
      eventType: e.eventType,
      officeName: e.officeLocation?.name || 'N/A',
      radiusMeters: e.officeLocation?.radiusMeters || 50,
      latitude: Number(e.latitude),
      longitude: Number(e.longitude),
      accuracyMeters: Number(e.accuracyMeters),
      distanceMeters: Number(e.distanceMeters),
      isWithinGeofence: e.isWithinGeofence,
      validationStatus: e.validationStatus,
      isMocked: e.isMocked,
      deviceModel: e.deviceModel,
      remarks: e.remarks,
    }));
  }

  /**
   * Headcount Report by Department
   */
  async getHeadcountReport(user: AuthenticatedUser, companyIdQuery?: string) {
    const targetCompanyId = user.isSuperAdmin
      ? companyIdQuery || user.companyId
      : user.companyId;

    const departments = await this.prisma.department.findMany({
      where: targetCompanyId ? { companyId: targetCompanyId } : {},
      include: {
        company: { select: { code: true, name: true } },
        _count: {
          select: { employees: true },
        },
      },
    });

    return departments.map((d) => ({
      companyCode: d.company.code,
      companyName: d.company.name,
      departmentName: d.name,
      employeeCount: d._count.employees,
    }));
  }

  /**
   * Attendance CSV Export Formatter
   */
  async exportAttendanceCsv(
    user: AuthenticatedUser,
    params: { companyId?: string; date: string },
  ): Promise<string> {
    const targetCompanyId =
      params.companyId ||
      user.activeCompanyId ||
      (user.isSuperAdmin ? undefined : user.companyId);

    const targetDate = new Date(params.date);
    targetDate.setHours(0, 0, 0, 0);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        date: targetDate,
        ...(targetCompanyId ? { companyId: targetCompanyId } : {}),
      },
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { employee: { employeeCode: 'asc' } },
    });

    const headers = [
      'Employee Code',
      'Employee Name',
      'Department',
      'Date',
      'Status',
      'First Check-In (IST)',
      'Last Check-Out (IST)',
      'Late Status',
      'Late Minutes',
      'Work Span (Mins)',
      'Remarks',
    ];

    const rows = records.map((r) => [
      r.employee.employeeCode,
      `"${r.employee.firstName} ${r.employee.lastName}"`,
      `"${r.employee.department?.name || 'N/A'}"`,
      r.date.toISOString().split('T')[0],
      r.status,
      r.firstCheckIn
        ? `"${r.firstCheckIn.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}"`
        : 'N/A',
      r.lastCheckOut
        ? `"${r.lastCheckOut.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}"`
        : 'N/A',
      r.isLate ? 'LATE' : 'ON_TIME',
      r.lateMinutes,
      r.totalWorkMinutes,
      `"${r.remarks || ''}"`,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}
