import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { ApplyLeaveDto, ReviewLeaveDto, CreateLeaveTypeDto, CalculateLeavePreviewDto } from './dto/leave.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  LeaveStatus,
  LeaveTransactionType,
  AttendanceStatus,
  NotificationType,
  Gender,
} from '@prisma/client';

@Injectable()
export class LeaveService {
  constructor(
    private prisma: PrismaService,
    @Optional() private trackingGateway?: TrackingGateway,
  ) {}

  async getLeaveTypes(user: AuthenticatedUser, companyIdQuery?: string) {
    const targetCompanyId =
      companyIdQuery ||
      user.activeCompanyId ||
      (user.isSuperAdmin ? undefined : user.companyId);

    const where: any = { isActive: true };
    if (targetCompanyId) {
      where.companyId = targetCompanyId;
    }

    return this.prisma.leaveType.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async createLeaveType(dto: CreateLeaveTypeDto, user: AuthenticatedUser) {
    const targetCompanyId =
      dto.companyId ||
      user.activeCompanyId ||
      user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestException('Company ID is required');
    }

    return this.prisma.leaveType.create({
      data: {
        companyId: targetCompanyId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description,
        isPaid: dto.isPaid !== undefined ? dto.isPaid : true,
        annualEntitlement: dto.annualEntitlement,
        maxConsecutiveDays: dto.maxConsecutiveDays || 7,
        requiresDocProof: dto.requiresDocProof || false,
      },
    });
  }

  async getMyBalances(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee profile required');
    }

    const currentYear = new Date().getFullYear();

    return this.prisma.leaveBalance.findMany({
      where: {
        employeeId: user.employeeId,
        year: currentYear,
      },
      include: {
        leaveType: true,
      },
    });
  }

  calculateLeaveDuration(
    startDate: Date,
    endDate: Date,
    leaveTypeCode: string,
    isHalfDay?: boolean,
  ): { totalDays: number; isSandwichApplied: boolean; sandwichDays: number; details: string } {
    if (isHalfDay) {
      return { totalDays: 0.5, isSandwichApplied: false, sandwichDays: 0, details: '0.5 Day (Half Day)' };
    }

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const calendarDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let effectiveDays = calendarDays;
    let isSandwich = false;
    let extraSandwichDays = 0;

    const startDay = startDate.getDay(); // 0: Sun, 1: Mon, 5: Fri, 6: Sat

    if (leaveTypeCode === 'EL') {
      if (calendarDays > 1) {
        // Spanning across weekends or holidays
        effectiveDays = calendarDays;
        isSandwich = true;
      } else if (calendarDays === 1) {
        if (startDay === 5) { // Friday
          // Note 1: Friday + Sat + Sun = 3 days
          effectiveDays = 3;
          isSandwich = true;
          extraSandwichDays = 2;
        } else if (startDay === 1) { // Monday
          // Note 1: Sat + Sun + Mon = 3 days
          effectiveDays = 3;
          isSandwich = true;
          extraSandwichDays = 2;
        }
      }
    }

    return {
      totalDays: effectiveDays,
      isSandwichApplied: isSandwich,
      sandwichDays: extraSandwichDays,
      details: isSandwich
        ? `${effectiveDays} Days (Sandwich Leave rule applied per Superbee Leave Policy)`
        : `${effectiveDays} Days`,
    };
  }

  async calculateLeavePreview(dto: CalculateLeavePreviewDto, user: AuthenticatedUser) {
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: dto.leaveTypeId },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const durationInfo = this.calculateLeaveDuration(
      start,
      end,
      leaveType.code,
      dto.isHalfDay,
    );

    let warning: string | null = null;
    if (leaveType.code === 'CL' && durationInfo.totalDays > 2) {
      warning = 'Policy Warning: Casual Leave (CL) can only be taken for a maximum of 2 days in a row. Excess will be treated as Earned Leave or LOP.';
    } else if (leaveType.code === 'SL' && durationInfo.totalDays > 1) {
      warning = 'Policy Note: Sick Leave exceeding 1 day requires a Doctor / Medical Certificate.';
    } else if (leaveType.code === 'EL') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntilLeave = Math.floor((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilLeave < 10) {
        warning = 'Policy Note: Earned Leave must normally be applied at least 10 days in advance with work replacement approval.';
      }
    }

    return {
      leaveTypeCode: leaveType.code,
      leaveTypeName: leaveType.name,
      ...durationInfo,
      warning,
    };
  }

  async applyLeave(dto: ApplyLeaveDto, user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee profile required');
    }

    const [employee, leaveType] = await Promise.all([
      this.prisma.employee.findUnique({
        where: { id: user.employeeId },
      }),
      this.prisma.leaveType.findUnique({
        where: { id: dto.leaveTypeId },
      }),
    ]);

    if (!employee) throw new BadRequestException('Employee profile not found');
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end < start) {
      throw new BadRequestException('End date cannot precede start date');
    }

    // Check overlap with existing active leave applications
    const overlapping = await this.prisma.leaveApplication.findFirst({
      where: {
        employeeId: user.employeeId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException('You already have a pending or approved leave application for these dates');
    }

    // Calculate effective duration using Superbee Leave Policy & Sandwich Rule
    const durationInfo = this.calculateLeaveDuration(
      start,
      end,
      leaveType.code,
      dto.isHalfDay,
    );
    const totalDays = durationInfo.totalDays;

    // Policy Rule Checks
    // 1. Casual Leave (CL): Max 2 days in a row, cannot prefix/suffix holidays
    if (leaveType.code === 'CL') {
      if (totalDays > 2) {
        throw new BadRequestException(
          'Superbee Leave Policy: Casual Leave (CL) can only be taken for a maximum of 2 days in a row. Absences exceeding 2 days must be applied as Earned Leave or Loss of Pay (LOP).'
        );
      }
      const sDay = start.getDay();
      const eDay = end.getDay();
      if (sDay === 0 || eDay === 0) {
        throw new BadRequestException(
          'Superbee Leave Policy: Casual Leave cannot fall on or bridge across Sunday (Weekly Off).'
        );
      }
    }

    // 2. Maternity Leave (ML): Only for female employees
    if (leaveType.code === 'ML') {
      if (employee.gender !== Gender.FEMALE) {
        throw new BadRequestException('Superbee Leave Policy: Maternity Leave is available only to female employees.');
      }
    }

    // 3. Paternity Leave (PL): Only for male employees
    if (leaveType.code === 'PL') {
      if (employee.gender !== Gender.MALE) {
        throw new BadRequestException('Superbee Leave Policy: Paternity Leave is available only to male employees.');
      }
    }

    // Verify balance
    const currentYear = start.getFullYear();
    const balance = await this.prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: user.employeeId,
          leaveTypeId: dto.leaveTypeId,
          year: currentYear,
        },
      },
    });

    if (balance) {
      if (Number(balance.availableDays) < totalDays) {
        throw new BadRequestException(
          `Insufficient leave balance for ${leaveType.name}. Requested: ${totalDays} day(s), but only ${balance.availableDays} day(s) remain in your account.`,
        );
      }
    } else {
      if (Number(leaveType.annualEntitlement) < totalDays) {
        throw new BadRequestException(
          `Insufficient leave balance for ${leaveType.name}. Entitlement: ${leaveType.annualEntitlement} day(s), Requested: ${totalDays} day(s).`,
        );
      }
    }

    const leaveApp = await this.prisma.$transaction(async (tx) => {
      const app = await tx.leaveApplication.create({
        data: {
          employeeId: user.employeeId!,
          companyId: user.companyId!,
          leaveTypeId: dto.leaveTypeId,
          startDate: start,
          endDate: end,
          isHalfDay: dto.isHalfDay || false,
          halfDayPeriod: dto.halfDayPeriod || null,
          totalDays,
          reason: dto.reason,
          attachmentPath: dto.attachmentPath || null,
          status: LeaveStatus.PENDING,
        },
        include: {
          leaveType: true,
          employee: true,
        },
      });

      // Update pending count in balance
      if (balance) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pendingDays: { increment: totalDays },
          },
        });
      }

      return app;
    });

    // Real-time broadcast to HR web dashboard
    if (this.trackingGateway && user.companyId) {
      try {
        this.trackingGateway.server?.to(`hr:${user.companyId}`).to('hr:live_tracking').emit('leave:update', {
          type: 'NEW_APPLICATION',
          applicationId: leaveApp.id,
          employeeId: leaveApp.employeeId,
          employeeName: `${leaveApp.employee.firstName} ${leaveApp.employee.lastName}`,
          leaveType: leaveApp.leaveType.name,
          leaveTypeCode: leaveApp.leaveType.code,
          days: leaveApp.totalDays,
          startDate: leaveApp.startDate,
          endDate: leaveApp.endDate,
          reason: leaveApp.reason,
          status: leaveApp.status,
          createdAt: leaveApp.createdAt,
        });
      } catch (_) {}
    }

    return leaveApp;
  }

  async getMyApplications(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee profile required');
    }

    return this.prisma.leaveApplication.findMany({
      where: { employeeId: user.employeeId },
      include: { leaveType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getApplications(
    user: AuthenticatedUser,
    params: { companyId?: string; status?: LeaveStatus },
  ) {
    const targetCompanyId =
      params.companyId ||
      user.activeCompanyId ||
      (user.isSuperAdmin ? undefined : user.companyId);

    const where: any = {};
    if (targetCompanyId) {
      where.companyId = targetCompanyId;
    }
    if (params.status) {
      where.status = params.status;
    }

    return this.prisma.leaveApplication.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
        leaveType: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewLeave(id: string, dto: ReviewLeaveDto, user: AuthenticatedUser) {
    const app = await this.prisma.leaveApplication.findUnique({
      where: { id },
      include: {
        employee: true,
        leaveType: true,
      },
    });

    if (!app) {
      throw new NotFoundException('Leave application not found');
    }

    if (!user.isSuperAdmin && user.companyId !== app.companyId) {
      throw new ForbiddenException('Cannot review leave for another company');
    }

    if (app.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Leave application is already ${app.status}`);
    }

    const currentYear = app.startDate.getFullYear();

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveApplication.update({
        where: { id },
        data: {
          status: dto.status,
          reviewedById: user.id,
          reviewRemarks: dto.reviewRemarks,
          reviewedAt: new Date(),
        },
      });

      const balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: app.employeeId,
            leaveTypeId: app.leaveTypeId,
            year: currentYear,
          },
        },
      });

      if (dto.status === LeaveStatus.APPROVED) {
        if (balance) {
          const oldAvail = Number(balance.availableDays);
          const newAvail = oldAvail - Number(app.totalDays);

          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              usedDays: { increment: app.totalDays },
              pendingDays: { decrement: app.totalDays },
              availableDays: newAvail,
            },
          });

          await tx.leaveBalanceTransaction.create({
            data: {
              employeeId: app.employeeId,
              leaveTypeId: app.leaveTypeId,
              type: LeaveTransactionType.DEBIT,
              amount: app.totalDays,
              previousBalance: oldAvail,
              newBalance: newAvail,
              reason: `Leave approved for ${app.startDate.toISOString().split('T')[0]} to ${app.endDate.toISOString().split('T')[0]}`,
              createdById: user.id,
            },
          });
        }

        // Mark attendance records as ON_LEAVE
        const curDate = new Date(app.startDate);
        while (curDate <= app.endDate) {
          await tx.attendanceRecord.upsert({
            where: {
              employeeId_date: {
                employeeId: app.employeeId,
                date: new Date(curDate),
              },
            },
            update: {
              status: AttendanceStatus.ON_LEAVE,
              remarks: `Approved ${app.leaveType.name}`,
            },
            create: {
              employeeId: app.employeeId,
              companyId: app.companyId,
              date: new Date(curDate),
              status: AttendanceStatus.ON_LEAVE,
              remarks: `Approved ${app.leaveType.name}`,
            },
          });
          curDate.setDate(curDate.getDate() + 1);
        }
      } else if (dto.status === LeaveStatus.REJECTED) {
        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              pendingDays: { decrement: app.totalDays },
            },
          });
        }
      }

      // Notification
      await tx.notification.create({
        data: {
          userId: app.employee.userId,
          companyId: app.companyId,
          type: NotificationType.LEAVE,
          referenceId: app.id,
          title: `Leave Application ${dto.status}`,
          message: `Your ${app.leaveType.name} request for ${app.startDate.toISOString().split('T')[0]} has been ${dto.status.toLowerCase()}.${dto.reviewRemarks ? ` Remarks: ${dto.reviewRemarks}` : ''}`,
        },
      });

      return updated;
    });

    if (this.trackingGateway && app.companyId) {
      try {
        this.trackingGateway.server?.to(`hr:${app.companyId}`).to('hr:live_tracking').emit('leave:update', {
          type: 'REVIEWED',
          applicationId: app.id,
          status: dto.status,
          employeeId: app.employeeId,
        });
        this.trackingGateway.server?.emit(`employee:${app.employee.userId}:leave_status`, {
          type: 'LEAVE_STATUS_CHANGED',
          status: dto.status,
          leaveType: app.leaveType.name,
          remarks: dto.reviewRemarks,
        });
      } catch (_) {}
    }

    return result;
  }

  getPolicyDocument() {
    return {
      company: {
        name: 'Superbee Aeronautics Pvt. Ltd.',
        unitType: 'MSME Manufacturing Unit',
        registeredOffice:
          'C/o Centurion University of Technology and Management (CUTM) Ramchandrapur, Jatni, Bhubaneswar, Khurda, Odisha, 752050',
        corporateOffice:
          'Flat No – 501, Akruthi Vijayalakshmi Residency, P & T Colony, Seethammadhara, Visakhapatnam, AP-530013',
      },
      sections: [
        {
          id: 1,
          title: '1. Objective',
          content:
            'This policy aims to define and standardize the types of leave available to employees, ensuring uniformity, compliance with applicable labour laws, and promoting operational efficiency while supporting employee well-being and work-life balance.',
        },
        {
          id: 2,
          title: '2. Scope',
          content:
            'This policy applies to all full-time employees of the company. Pro-rata leave may be applicable to part-time, contract, or probationary staff.',
        },
        {
          id: 3,
          title: '3. Types of Leave',
          table: [
            {
              type: 'Casual Leave (CL)',
              entitlement: '7 days',
              eligibility: 'From Date of Joining',
              carryForward: 'No (Lapses at year end)',
              notes: 'For unforeseen personal reasons. Max 2 days in a row. Cannot prefix/suffix holidays.',
            },
            {
              type: 'Sick Leave (SL)',
              entitlement: '7 days',
              eligibility: 'From Date of Joining',
              carryForward: 'No (Lapses at year end)',
              notes: "Medical certificate required for >1 day (or >2 days). To recover from illness.",
            },
            {
              type: 'Earned Leave (EL / Privileged)',
              entitlement: '15 days (1.25 days per month of service)',
              eligibility: 'After completion of probation or 6 months (240 days service)',
              carryForward: 'Yes (Max 30 days carry forward; additional lapses)',
              notes: 'Sandwich leave rule applies. Apply at least 10 days in advance with replacement & handover.',
            },
            {
              type: 'Maternity Leave',
              entitlement: '26 weeks (12 weeks for >2 children)',
              eligibility: 'Married female employees with >80 days service in past 12 months',
              carryForward: 'No',
              notes: 'Applicable for first two children. Max 2 instances. Up to 8 weeks pre-delivery.',
            },
            {
              type: 'Paternity Leave',
              entitlement: '15 days',
              eligibility: 'Married male employees after 6 months of service / post-probation',
              carryForward: 'No',
              notes: 'Within 15 days of child birth. Max 2 instances during employment.',
            },
          ],
        },
        {
          id: 4,
          title: '4. General Guidelines',
          guidelines: [
            'Leave Application/Request: Must be submitted via email or HR portal at least 2 days in advance (except for emergencies).',
            'Approval: All leave must be approved by the Reporting Manager and HR Manager.',
            'Sandwich Leave: Weekly offs and holidays falling between leave days are also counted as leave, unless the employee attends work between them.',
            'Uninformed Absence: Treated as Loss of Pay (LOP) and may attract disciplinary action.',
            'Leave Balance: Will be updated monthly and shared via HR Manager.',
          ],
        },
        {
          id: 5,
          title: '5. Leave during Probation Period',
          content:
            'Employees under probation can avail CL and SL only on a pro-rata basis. EL accrual starts post-probation or after 6 months of continuous service.',
        },
        {
          id: 6,
          title: '6. Leave Encashment Policy',
          content:
            'Unused Earned Leave can be encashed at the end of financial year or upon resignation at the basic pay rate. Maximum 30 days can be carried forward; additional days will lapse. (Note: During the course of employment, encashment will not be applicable. It shall apply only upon resignation or retirement).',
        },
        {
          id: 7,
          title: '7. Exceptions & Flexibility',
          content:
            'In case of emergencies or critical illness, leave without pay (LWP) may be granted at the discretion of Management. Festival holidays or State/Central Govt. holidays will be notified separately as part of the Holiday Calendar.',
        },
        {
          id: 8,
          title: '8. Special Considerations for Drone Operations Teams',
          guidelines: [
            'Leave during active flight testing/project deadlines should be avoided unless critical.',
            'Field engineers and drone pilots must coordinate leave with project schedules.',
          ],
        },
        {
          id: 9,
          title: '9. Policy Review & Sandwich Leave Examples',
          examples: [
            'Example 1: If Saturday and Sunday are holidays, and you take leave on Friday, then Friday, Saturday, and Sunday will all be counted as leave.',
            'Example 2: If Saturday and Sunday are holidays, and you take leave on Monday, then Saturday, Sunday, and Monday will be counted as leave.',
            'Example 3: If Saturday and Sunday are weekly holidays and you apply for Earned Leave on Friday and Monday, then Friday + Saturday + Sunday + Monday = 4 days will be considered as leave.',
          ],
        },
      ],
    };
  }

  async getEncashmentEstimate(employeeId: string, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        company: true,
        salaryStructures: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    const currentYear = new Date().getFullYear();
    const elType = await this.prisma.leaveType.findFirst({
      where: { companyId: employee.companyId, code: 'EL' },
    });

    let elBalance = 0;
    if (elType) {
      const balance = await this.prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId: elType.id,
            year: currentYear,
          },
        },
      });
      if (balance) elBalance = Number(balance.availableDays);
    }

    const encashableDays = Math.min(elBalance, 30);
    const basicSalary = employee.salaryStructures?.[0]?.basicSalary
      ? Number(employee.salaryStructures[0].basicSalary)
      : 50000;

    const dailyBasicRate = basicSalary / 30;
    const estimatedEncashment = Math.round(encashableDays * dailyBasicRate);

    return {
      employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      company: employee.company.name,
      totalEarnedLeaveBalance: elBalance,
      encashableDays,
      lapsedDays: Math.max(0, elBalance - 30),
      monthlyBasicSalary: basicSalary,
      dailyBasicRate: Math.round(dailyBasicRate),
      estimatedEncashmentAmount: estimatedEncashment,
      policyNote:
        'Unused Earned Leave can be encashed upon resignation or retirement at the basic pay rate (max 30 days).',
    };
  }
}
