import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProcessPayrollDto,
  OverridePayrollItemDto,
  CreateSalaryStructureDto,
  GenerateIndividualPayslipDto,
  BulkUploadPayrollDto,
  FinalizeAllPayrollDto,
} from './dto/payroll.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  PayrollStatus,
  PayrollRecordStatus,
  AttendanceStatus,
  LineItemType,
  NotificationType,
} from '@prisma/client';
import { generatePayslipPdfBuffer } from './utils/payslip-pdf.util';
import {
  generateDetailSummaryExcel,
  DetailSummaryData,
  DetailSummaryEmployeeRow,
} from './utils/detail-summary-excel.util';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  async processPayroll(dto: ProcessPayrollDto, user: AuthenticatedUser) {
    const targetCompanyId =
      dto.companyId ||
      user.activeCompanyId ||
      user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestException('Target Company ID is required');
    }

    const { year, month } = dto;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    const totalDaysInMonth = endDate.getDate();

    // 1. Upsert PayrollPeriod
    const payrollPeriod = await this.prisma.payrollPeriod.upsert({
      where: {
        companyId_year_month: {
          companyId: targetCompanyId,
          year,
          month,
        },
      },
      update: {
        status: PayrollStatus.PROCESSING,
      },
      create: {
        companyId: targetCompanyId,
        year,
        month,
        startDate,
        endDate,
        totalWorkingDays: totalDaysInMonth,
        status: PayrollStatus.PROCESSING,
      },
    });

    // 2. Fetch all employees in this company with active salary structures
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: targetCompanyId,
        employmentStatus: { in: ['FULL_TIME', 'PROBATION', 'CONTRACT'] },
      },
      include: {
        salaryStructures: {
          where: { isActive: true },
          take: 1,
        },
        attendanceRecords: {
          where: {
            date: { gte: startDate, lte: endDate },
          },
        },
      },
    });

    const recordsCreated = [];

    for (const emp of employees) {
      const salaryStructure = emp.salaryStructures[0];
      if (!salaryStructure) {
        continue; // Skip employee without salary structure
      }

      // Compute Attendance Metrics
      let presentDays = 0;
      let paidLeaveDays = 0;
      let holidayDays = 0;

      for (const att of emp.attendanceRecords) {
        if (att.status === AttendanceStatus.PRESENT) presentDays += 1;
        else if (att.status === AttendanceStatus.HALF_DAY) presentDays += 0.5;
        else if (att.status === AttendanceStatus.ON_LEAVE) paidLeaveDays += 1;
        else if (att.status === AttendanceStatus.HOLIDAY) holidayDays += 1;
      }

      // Estimate working days and LOP
      // Payable days = present + paid leaves + weekend/holiday credit
      const payableDays = Math.min(totalDaysInMonth, presentDays + paidLeaveDays + 8);
      const lopDays = Math.max(0, totalDaysInMonth - payableDays);

      const prorationFactor = payableDays / totalDaysInMonth;

      const basicEarnings = Math.round(Number(salaryStructure.basicSalary) * prorationFactor);
      const hraEarnings = Math.round(Number(salaryStructure.hra) * prorationFactor);
      const conveyanceEarnings = Math.round(Number(salaryStructure.conveyance) * prorationFactor);
      const specialEarnings = Math.round(
        Number(salaryStructure.specialAllowance) * prorationFactor,
      );

      const grossEarnings = basicEarnings + hraEarnings + conveyanceEarnings + specialEarnings;

      const epf = Number(salaryStructure.epfEmployee);
      const pt = Number(salaryStructure.professionalTax);
      const totalDeductions = epf + pt;
      const netSalary = grossEarnings - totalDeductions;

      // Upsert PayrollRecord
      const record = await this.prisma.payrollRecord.upsert({
        where: {
          payrollPeriodId_employeeId_revision: {
            payrollPeriodId: payrollPeriod.id,
            employeeId: emp.id,
            revision: 1,
          },
        },
        update: {
          totalDaysInMonth,
          payableDays,
          presentDays,
          paidLeaveDays,
          lopDays,
          holidayDays,
          basicEarnings,
          allowancesEarnings: hraEarnings + conveyanceEarnings + specialEarnings,
          grossEarnings,
          statutoryDeductions: totalDeductions,
          totalDeductions,
          netSalary,
          status: PayrollRecordStatus.CALCULATED,
          payslipGenerated: true,
        },
        create: {
          payrollPeriodId: payrollPeriod.id,
          employeeId: emp.id,
          companyId: targetCompanyId,
          revision: 1,
          totalDaysInMonth,
          payableDays,
          presentDays,
          paidLeaveDays,
          lopDays,
          holidayDays,
          weekOffDays: 8,
          basicEarnings,
          allowancesEarnings: hraEarnings + conveyanceEarnings + specialEarnings,
          grossEarnings,
          statutoryDeductions: totalDeductions,
          otherDeductions: 0,
          totalDeductions,
          netSalary,
          status: PayrollRecordStatus.CALCULATED,
          payslipGenerated: true,
        },
      });

      recordsCreated.push(record);
    }

    // Update status to REVIEW
    await this.prisma.payrollPeriod.update({
      where: { id: payrollPeriod.id },
      data: { status: PayrollStatus.REVIEW },
    });

    return {
      payrollPeriodId: payrollPeriod.id,
      year,
      month,
      processedEmployees: recordsCreated.length,
      status: PayrollStatus.REVIEW,
    };
  }

  async getPayrollPeriods(user: AuthenticatedUser, companyIdQuery?: string) {
    const targetCompanyId =
      companyIdQuery ||
      user.activeCompanyId ||
      (user.isSuperAdmin ? undefined : user.companyId);

    const where: any = {};
    if (targetCompanyId) {
      where.companyId = targetCompanyId;
    }

    return this.prisma.payrollPeriod.findMany({
      where,
      include: {
        company: { select: { id: true, code: true, name: true } },
        _count: { select: { records: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async getPayrollRecords(payrollPeriodId: string, user: AuthenticatedUser) {
    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id: payrollPeriodId },
    });

    if (!period) {
      throw new NotFoundException('Payroll period not found');
    }

    if (!user.isSuperAdmin && user.companyId !== period.companyId) {
      throw new ForbiddenException('Access denied to other company payroll records');
    }

    return this.prisma.payrollRecord.findMany({
      where: { payrollPeriodId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
      },
      orderBy: { employee: { employeeCode: 'asc' } },
    });
  }

  async finalizePayroll(payrollPeriodId: string, user: AuthenticatedUser) {
    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id: payrollPeriodId },
      include: { records: { include: { employee: true } } },
    });

    if (!period) {
      throw new NotFoundException('Payroll period not found');
    }

    if (!user.isSuperAdmin && user.companyId !== period.companyId) {
      throw new ForbiddenException('Cannot finalize another company payroll');
    }

    return this.prisma.$transaction(async (tx) => {
      const finalized = await tx.payrollPeriod.update({
        where: { id: payrollPeriodId },
        data: {
          status: PayrollStatus.FINALIZED,
          finalizedAt: new Date(),
          finalizedById: user.id,
        },
      });

      await tx.payrollRecord.updateMany({
        where: { payrollPeriodId },
        data: { status: PayrollRecordStatus.FINALIZED },
      });

      // Send notifications to employees that payslip is available
      for (const rec of period.records) {
        await tx.notification.create({
          data: {
            userId: rec.employee.userId,
            companyId: period.companyId,
            type: NotificationType.PAYROLL,
            referenceId: rec.id,
            title: `Payslip Available for ${period.month}/${period.year}`,
            message: `Your payslip for ${period.month}/${period.year} has been generated and is now available for download.`,
          },
        });
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          companyId: period.companyId,
          actorId: user.id,
          actorEmail: user.email,
          action: 'PAYROLL_FINALIZED',
          entityName: 'PayrollPeriod',
          entityId: payrollPeriodId,
          afterJson: JSON.stringify({ year: period.year, month: period.month }),
          reason: 'Monthly payroll finalization',
        },
      });

      return finalized;
    });
  }

  async overridePayrollItem(dto: OverridePayrollItemDto, user: AuthenticatedUser) {
    const record = await this.prisma.payrollRecord.findUnique({
      where: { id: dto.recordId },
      include: { payrollPeriod: true },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }

    if (!user.isSuperAdmin && user.companyId !== record.companyId) {
      throw new ForbiddenException('Cannot modify another company payroll');
    }

    if (record.payrollPeriod.status === PayrollStatus.FINALIZED) {
      throw new BadRequestException('Cannot override record of a finalized payroll period');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payrollRecord.update({
        where: { id: dto.recordId },
        data: {
          netSalary: dto.netSalary,
          isOverridden: true,
          overrideReason: dto.reason,
          overriddenBy: user.email,
          status: PayrollRecordStatus.ADJUSTED,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: record.companyId,
          actorId: user.id,
          actorEmail: user.email,
          action: 'PAYROLL_OVERRIDE',
          entityName: 'PayrollRecord',
          entityId: record.id,
          beforeJson: JSON.stringify({ netSalary: Number(record.netSalary) }),
          afterJson: JSON.stringify({ netSalary: dto.netSalary }),
          reason: dto.reason,
        },
      });

      return updated;
    });
  }

  async getMyPayslips(user: AuthenticatedUser) {
    let employeeId = user.employeeId;
    if (!employeeId) {
      const emp = await this.prisma.employee.findUnique({
        where: { userId: user.id },
      });
      employeeId = emp?.id;
    }

    if (!employeeId) {
      return [];
    }

    return this.prisma.payrollRecord.findMany({
      where: {
        employeeId,
        OR: [
          { payslipGenerated: true },
          { status: PayrollRecordStatus.FINALIZED },
        ],
      },
      include: {
        payrollPeriod: true,
        lineItems: true,
        company: { select: { id: true, name: true, code: true } },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            bankName: true,
            bankAccountNumber: true,
            panNumber: true,
            designation: { select: { title: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async generateIndividualPayslip(dto: GenerateIndividualPayslipDto, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: {
        company: true,
        user: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!user.isSuperAdmin && user.companyId !== employee.companyId) {
      throw new ForbiddenException('Cannot generate payslip for employee in another company');
    }

    const { year, month } = dto;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const daysInMonth = endDate.getDate();
    const totalDays = dto.totalDays || daysInMonth;
    const paidDays = dto.paidDays !== undefined ? dto.paidDays : totalDays;

    // 1. Ensure PayrollPeriod exists for this company, year, and month
    const payrollPeriod = await this.prisma.payrollPeriod.upsert({
      where: {
        companyId_year_month: {
          companyId: employee.companyId,
          year,
          month,
        },
      },
      update: {},
      create: {
        companyId: employee.companyId,
        year,
        month,
        startDate,
        endDate,
        totalWorkingDays: daysInMonth,
        status: PayrollStatus.PROCESSING,
      },
    });

    // 2. Earnings calculations
    const basicSalary = Number(dto.basicSalary);
    const hraAmount = dto.hraEnabled ? Number(dto.hra || 0) : 0;
    const daAmount = dto.daEnabled ? Number(dto.da || 0) : 0;
    const medicalAmount = dto.medicalAllowanceEnabled ? Number(dto.medicalAllowance || 0) : 0;
    const otherAmount = dto.otherAllowanceEnabled ? Number(dto.otherAllowance || 0) : 0;

    const allowancesEarnings = hraAmount + daAmount + medicalAmount + otherAmount;
    const grossEarnings = basicSalary + allowancesEarnings;

    // Deductions calculations
    const epf = Number(dto.epf || 0);
    const professionalTax = Number(dto.professionalTax || 0);
    const tds = Number(dto.tds || 0);

    // Automatic LOP (Loss of Pay) for unapproved leaves:
    // Per-day rate = gross monthly earnings / total working days in month
    const perDaySalary = totalDays > 0 ? grossEarnings / totalDays : 0;
    const finalLopDays = dto.lopDays !== undefined 
      ? Number(dto.lopDays) 
      : Math.max(0, totalDays - paidDays);
    const finalLopAmount = dto.lopAmount !== undefined && dto.lopAmount > 0
      ? Number(dto.lopAmount)
      : Math.round(perDaySalary * finalLopDays);

    const statutoryDeductions = epf + professionalTax;
    const otherDeductions = tds + finalLopAmount;
    const totalDeductions = statutoryDeductions + otherDeductions;
    const netSalary = Math.max(0, grossEarnings - totalDeductions);

    const recordStatus = dto.finalize ? PayrollRecordStatus.FINALIZED : PayrollRecordStatus.CALCULATED;

    return this.prisma.$transaction(async (tx) => {
      // Upsert record
      const record = await tx.payrollRecord.upsert({
        where: {
          payrollPeriodId_employeeId_revision: {
            payrollPeriodId: payrollPeriod.id,
            employeeId: employee.id,
            revision: 1,
          },
        },
        update: {
          totalDaysInMonth: totalDays,
          payableDays: paidDays,
          presentDays: paidDays,
          paidLeaveDays: 0,
          lopDays: finalLopDays,
          basicEarnings: basicSalary,
          allowancesEarnings,
          grossEarnings,
          statutoryDeductions,
          otherDeductions,
          totalDeductions,
          netSalary,
          status: recordStatus,
          payslipGenerated: true,
          payslipGeneratedAt: new Date(),
        },
        create: {
          payrollPeriodId: payrollPeriod.id,
          employeeId: employee.id,
          companyId: employee.companyId,
          revision: 1,
          totalDaysInMonth: totalDays,
          payableDays: paidDays,
          presentDays: paidDays,
          paidLeaveDays: 0,
          lopDays: finalLopDays,
          holidayDays: 0,
          weekOffDays: 4,
          basicEarnings: basicSalary,
          allowancesEarnings,
          grossEarnings,
          statutoryDeductions,
          otherDeductions,
          totalDeductions,
          netSalary,
          status: recordStatus,
          payslipGenerated: true,
          payslipGeneratedAt: new Date(),
        },
      });

      // Clear existing line items and recreate with fresh items
      await tx.payrollLineItem.deleteMany({
        where: { payrollRecordId: record.id },
      });

      const lineItemsToCreate: Array<{
        payrollRecordId: string;
        type: LineItemType;
        name: string;
        amount: number;
      }> = [
        {
          payrollRecordId: record.id,
          type: LineItemType.EARNING,
          name: 'Basic Salary',
          amount: basicSalary,
        },
      ];

      if (dto.hraEnabled && hraAmount > 0) {
        lineItemsToCreate.push({
          payrollRecordId: record.id,
          type: LineItemType.EARNING,
          name: 'House Rent Allowance (HRA)',
          amount: hraAmount,
        });
      }
      if (dto.daEnabled && daAmount > 0) {
        lineItemsToCreate.push({
          payrollRecordId: record.id,
          type: LineItemType.EARNING,
          name: 'Dearness Allowance (DA)',
          amount: daAmount,
        });
      }
      if (dto.medicalAllowanceEnabled && medicalAmount > 0) {
        lineItemsToCreate.push({
          payrollRecordId: record.id,
          type: LineItemType.EARNING,
          name: 'Medical Allowance',
          amount: medicalAmount,
        });
      }
      if (dto.otherAllowanceEnabled && otherAmount > 0) {
        lineItemsToCreate.push({
          payrollRecordId: record.id,
          type: LineItemType.EARNING,
          name: 'Other Allowance',
          amount: otherAmount,
        });
      }
      if (epf > 0) {
        lineItemsToCreate.push({
          payrollRecordId: record.id,
          type: LineItemType.DEDUCTION,
          name: 'Employees Provident Fund (EPF)',
          amount: epf,
        });
      }
      if (professionalTax > 0) {
        lineItemsToCreate.push({
          payrollRecordId: record.id,
          type: LineItemType.DEDUCTION,
          name: 'Professional Tax (PT)',
          amount: professionalTax,
        });
      }
      if (tds > 0) {
        lineItemsToCreate.push({
          payrollRecordId: record.id,
          type: LineItemType.DEDUCTION,
          name: 'TDS / Income Tax',
          amount: tds,
        });
      }
      if (finalLopAmount > 0) {
        lineItemsToCreate.push({
          payrollRecordId: record.id,
          type: LineItemType.DEDUCTION,
          name: `Loss of Pay (LOP) - ${finalLopDays} Day(s)`,
          amount: finalLopAmount,
        });
      }

      await tx.payrollLineItem.createMany({
        data: lineItemsToCreate,
      });

      // Update employee SalaryStructure so these salary details carry forward automatically month after month!
      await tx.salaryStructure.updateMany({
        where: { employeeId: employee.id },
        data: { isActive: false },
      });

      await tx.salaryStructure.create({
        data: {
          employeeId: employee.id,
          companyId: employee.companyId,
          effectiveDate: new Date(year, month - 1, 1),
          basicSalary,
          hra: hraAmount,
          conveyance: 0,
          medicalAllowance: medicalAmount,
          specialAllowance: otherAmount,
          otherAllowances: daAmount,
          grossMonthly: grossEarnings,
          epfEmployee: epf,
          epfEmployer: epf,
          professionalTax,
          tdsMonthly: tds,
          otherDeductions: 0,
          totalDeductions: statutoryDeductions + tds,
          netMonthly: netSalary,
          ctcAnnual: grossEarnings * 12,
          isActive: true,
        },
      });

      // If finalized, send employee notification & audit log
      if (dto.finalize) {
        await tx.notification.create({
          data: {
            userId: employee.userId,
            companyId: employee.companyId,
            type: NotificationType.PAYROLL,
            referenceId: record.id,
            title: `Payslip Finalized for ${month}/${year}`,
            message: `Your payslip for ${month}/${year} has been finalized by HR and is ready for download in your mobile app. Net Salary: ₹${netSalary.toFixed(2)}`,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId: employee.companyId,
            actorId: user.id,
            actorEmail: user.email,
            action: 'INDIVIDUAL_PAYSLIP_FINALIZED',
            entityName: 'PayrollRecord',
            entityId: record.id,
            afterJson: JSON.stringify({
              employeeId: employee.id,
              employeeCode: employee.employeeCode,
              year,
              month,
              grossEarnings,
              netSalary,
            }),
            reason: 'Individual employee payslip finalized by HR',
          },
        });
      }

      return tx.payrollRecord.findUnique({
        where: { id: record.id },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              department: { select: { name: true } },
              designation: { select: { title: true } },
            },
          },
          payrollPeriod: true,
          lineItems: true,
        },
      });
    });
  }

  async finalizeIndividualRecord(recordId: string, user: AuthenticatedUser) {
    const record = await this.prisma.payrollRecord.findUnique({
      where: { id: recordId },
      include: {
        employee: true,
        payrollPeriod: true,
      },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }

    if (!user.isSuperAdmin && user.companyId !== record.companyId) {
      throw new ForbiddenException('Cannot finalize record of another company');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payrollRecord.update({
        where: { id: recordId },
        data: {
          status: PayrollRecordStatus.FINALIZED,
          payslipGenerated: true,
          payslipGeneratedAt: new Date(),
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              department: { select: { name: true } },
              designation: { select: { title: true } },
            },
          },
          payrollPeriod: true,
          lineItems: true,
        },
      });

      await tx.notification.create({
        data: {
          userId: record.employee.userId,
          companyId: record.companyId,
          type: NotificationType.PAYROLL,
          referenceId: record.id,
          title: `Payslip Finalized for ${record.payrollPeriod.month}/${record.payrollPeriod.year}`,
          message: `Your payslip for ${record.payrollPeriod.month}/${record.payrollPeriod.year} has been finalized by HR and is available in your mobile app. Net Salary: ₹${Number(record.netSalary).toFixed(2)}`,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: record.companyId,
          actorId: user.id,
          actorEmail: user.email,
          action: 'PAYSLIP_FINALIZED',
          entityName: 'PayrollRecord',
          entityId: record.id,
          afterJson: JSON.stringify({
            employeeId: record.employeeId,
            year: record.payrollPeriod.year,
            month: record.payrollPeriod.month,
            netSalary: Number(record.netSalary),
          }),
          reason: 'Individual payslip finalization by HR',
        },
      });

      return updated;
    });
  }

  async generatePayslipPdf(recordId: string, user: AuthenticatedUser): Promise<Buffer> {
    const record = await this.prisma.payrollRecord.findUnique({
      where: { id: recordId },
      include: {
        payrollPeriod: true,
        company: true,
        lineItems: true,
        employee: {
          include: {
            department: true,
            designation: true,
            officeLocation: true,
            salaryStructures: { where: { isActive: true }, take: 1 },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }

    // Verify Authorization: only the employee or authorized HR can access
    const isOwner = user.employeeId === record.employeeId;
    const isHrAuthorized =
      (user.isSuperAdmin || user.roles.includes('HR_ADMIN') || user.roles.includes('HR_MANAGER')) &&
      (user.isSuperAdmin || user.companyId === record.companyId);

    if (!isOwner && !isHrAuthorized) {
      throw new ForbiddenException('You are not authorized to download this payslip');
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const salary = record.employee.salaryStructures[0];

    // Find specific line items if stored
    const hraItem = record.lineItems.find(l => l.name.includes('HRA'));
    const daItem = record.lineItems.find(l => l.name.includes('DA') || l.name.includes('Dearness'));
    const medicalItem = record.lineItems.find(l => l.name.includes('Medical'));
    const otherItem = record.lineItems.find(l => l.name.includes('Other'));
    const epfItem = record.lineItems.find(l => l.name.includes('EPF') || l.name.includes('Provident'));
    const ptItem = record.lineItems.find(l => l.name.includes('Tax') || l.name.includes('PT'));
    const tdsItem = record.lineItems.find(l => l.name.includes('TDS'));

    const pdfData = {
      companyName: record.company.name,
      companyAddress: record.company.address || undefined,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
      employeeCode: record.employee.employeeCode,
      department: record.employee.department?.name || 'Aeronautics',
      designation: record.employee.designation?.title || 'Engineer',
      joiningDate: record.employee.joiningDate.toISOString().split('T')[0],
      bankAccount: record.employee.bankAccountNumber || undefined,
      bankName: record.employee.bankName || 'HDFC Bank',
      panNumber: record.employee.panNumber || undefined,
      uanNumber: record.employee.uanNumber || undefined,
      location: record.employee.officeLocation?.name || 'Vizianagaram, AP',
      monthName: monthNames[record.payrollPeriod.month - 1] || 'Month',
      year: record.payrollPeriod.year,
      totalDays: record.totalDaysInMonth,
      presentDays: Number(record.presentDays),
      paidLeaveDays: Number(record.paidLeaveDays),
      lopDays: Number(record.lopDays),
      basicSalary: Number(record.basicEarnings),
      hra: hraItem ? Number(hraItem.amount) : (salary ? Number(salary.hra) : 0),
      da: daItem ? Number(daItem.amount) : 0,
      medicalAllowance: medicalItem ? Number(medicalItem.amount) : (salary ? Number(salary.medicalAllowance) : 0),
      otherAllowances: otherItem ? Number(otherItem.amount) : (salary ? Number(salary.otherAllowances) : 0),
      conveyance: salary ? Number(salary.conveyance) : 0,
      specialAllowance: salary ? Number(salary.specialAllowance) : 0,
      grossEarnings: Number(record.grossEarnings),
      epfEmployee: epfItem ? Number(epfItem.amount) : (salary ? Number(salary.epfEmployee) : 0),
      professionalTax: ptItem ? Number(ptItem.amount) : (salary ? Number(salary.professionalTax) : 0),
      tds: tdsItem ? Number(tdsItem.amount) : 0,
      totalDeductions: Number(record.totalDeductions),
      netSalary: Number(record.netSalary),
      lineItems: record.lineItems.map(l => ({
        name: l.name,
        amount: Number(l.amount),
        type: l.type as 'EARNING' | 'DEDUCTION',
      })),
    };

    return generatePayslipPdfBuffer(pdfData);
  }

  async saveSalaryStructure(dto: CreateSalaryStructureDto, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!user.isSuperAdmin && user.companyId !== employee.companyId) {
      throw new ForbiddenException('Cannot modify salary of another company');
    }

    const gross = dto.basicSalary + dto.hra + dto.conveyance + dto.specialAllowance;
    const totalDed = dto.epfEmployee + dto.professionalTax;
    const net = gross - totalDed;

    // Deactivate previous
    await this.prisma.salaryStructure.updateMany({
      where: { employeeId: dto.employeeId },
      data: { isActive: false },
    });

    return this.prisma.salaryStructure.create({
      data: {
        employeeId: dto.employeeId,
        companyId: employee.companyId,
        effectiveDate: new Date(),
        basicSalary: dto.basicSalary,
        hra: dto.hra,
        conveyance: dto.conveyance,
        specialAllowance: dto.specialAllowance,
        grossMonthly: gross,
        epfEmployee: dto.epfEmployee,
        epfEmployer: dto.epfEmployee,
        professionalTax: dto.professionalTax,
        totalDeductions: totalDed,
        netMonthly: net,
        ctcAnnual: gross * 12,
        isActive: true,
      },
    });
  }

  async getMonthlyPayrollOverview(
    year: number,
    month: number,
    user: AuthenticatedUser,
    companyIdQuery?: string,
  ) {
    const targetCompanyId =
      companyIdQuery ||
      user.activeCompanyId ||
      user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestException('Company ID is required');
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    const totalDaysInMonth = endDate.getDate();

    // 1. Fetch period if exists
    const period = await this.prisma.payrollPeriod.findUnique({
      where: {
        companyId_year_month: {
          companyId: targetCompanyId,
          year,
          month,
        },
      },
    });

    // 2. Fetch all active employees in this company
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: targetCompanyId,
        employmentStatus: { in: ['FULL_TIME', 'PROBATION', 'CONTRACT'] },
      },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
        salaryStructures: {
          where: { isActive: true },
          orderBy: { effectiveDate: 'desc' },
          take: 1,
        },
        payrollRecords: {
          where: {
            payrollPeriod: {
              year,
              month,
            },
          },
          include: {
            lineItems: true,
          },
          take: 1,
        },
        attendanceRecords: {
          where: {
            date: { gte: startDate, lte: endDate },
          },
        },
      },
      orderBy: { employeeCode: 'asc' },
    });

    let totalGrossPayout = 0;
    let totalNetPayout = 0;
    let totalDeductionsAmount = 0;
    let finalizedCount = 0;

    const employeeRows = employees.map((emp) => {
      const record = emp.payrollRecords[0];
      const salary = emp.salaryStructures[0];

      // Auto-detect unapproved leaves (ABSENT records in attendance history)
      const absentDays = emp.attendanceRecords.filter(
        (a) => a.status === AttendanceStatus.ABSENT,
      ).length;

      if (record) {
        // Record already exists for this period
        const isFinalized = record.status === PayrollRecordStatus.FINALIZED;
        if (isFinalized) finalizedCount += 1;

        const basic = Number(record.basicEarnings);
        const allowances = Number(record.allowancesEarnings);
        const gross = Number(record.grossEarnings);
        const deductions = Number(record.totalDeductions);
        const net = Number(record.netSalary);
        const lopDays = Number(record.lopDays);

        // Find individual line items if present
        const hraItem = record.lineItems.find((l) => l.name.includes('HRA'));
        const daItem = record.lineItems.find((l) => l.name.includes('DA') || l.name.includes('Dearness'));
        const medicalItem = record.lineItems.find((l) => l.name.includes('Medical'));
        const otherItem = record.lineItems.find((l) => l.name.includes('Other'));
        const epfItem = record.lineItems.find((l) => l.name.includes('EPF') || l.name.includes('Provident'));
        const ptItem = record.lineItems.find((l) => l.name.includes('Tax') || l.name.includes('PT'));
        const tdsItem = record.lineItems.find((l) => l.name.includes('TDS'));

        totalGrossPayout += gross;
        totalNetPayout += net;
        totalDeductionsAmount += deductions;

        return {
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          firstName: emp.firstName,
          lastName: emp.lastName,
          fullName: `${emp.firstName} ${emp.lastName}`,
          department: emp.department?.name || 'General',
          designation: emp.designation?.title || 'Staff',
          avatarUrl: emp.avatarUrl,
          recordId: record.id,
          status: record.status,
          isFinalized,
          hasExistingRecord: true,
          isCarriedForward: false,
          totalDays: record.totalDaysInMonth,
          paidDays: Number(record.payableDays),
          lopDays,
          basicSalary: basic,
          hra: hraItem ? Number(hraItem.amount) : (salary ? Number(salary.hra) : 0),
          da: daItem ? Number(daItem.amount) : 0,
          medicalAllowance: medicalItem ? Number(medicalItem.amount) : (salary ? Number(salary.medicalAllowance) : 0),
          otherAllowances: otherItem ? Number(otherItem.amount) : (salary ? Number(salary.otherAllowances) : 0),
          specialAllowance: salary ? Number(salary.specialAllowance) : 0,
          conveyance: salary ? Number(salary.conveyance) : 0,
          allowancesEarnings: allowances,
          grossEarnings: gross,
          epf: epfItem ? Number(epfItem.amount) : (salary ? Number(salary.epfEmployee) : 0),
          professionalTax: ptItem ? Number(ptItem.amount) : (salary ? Number(salary.professionalTax) : 0),
          tds: tdsItem ? Number(tdsItem.amount) : (salary ? Number(salary.tdsMonthly) : 0),
          totalDeductions: deductions,
          netSalary: net,
        };
      }

      // No record yet: Use carried forward SalaryStructure (or standard defaults)
      const basic = salary ? Number(salary.basicSalary) : 50000;
      const hra = salary ? Number(salary.hra) : 20000;
      const conveyance = salary ? Number(salary.conveyance) : 0;
      const medical = salary ? Number(salary.medicalAllowance) : 1250;
      const special = salary ? Number(salary.specialAllowance) : 0;
      const other = salary ? Number(salary.otherAllowances) : 0;

      const allowancesEarnings = hra + conveyance + medical + special + other;
      const grossEarnings = basic + allowancesEarnings;

      const epf = salary ? Number(salary.epfEmployee) : 6000;
      const pt = salary ? Number(salary.professionalTax) : 200;
      const tds = salary ? Number(salary.tdsMonthly) : 0;

      // LOP deduction calculation based on unapproved leaves detected
      const perDayRate = totalDaysInMonth > 0 ? grossEarnings / totalDaysInMonth : 0;
      const lopAmount = Math.round(perDayRate * absentDays);
      const totalDeductions = epf + pt + tds + lopAmount;
      const netSalary = Math.max(0, grossEarnings - totalDeductions);
      const paidDays = Math.max(0, totalDaysInMonth - absentDays);

      totalGrossPayout += grossEarnings;
      totalNetPayout += netSalary;
      totalDeductionsAmount += totalDeductions;

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName: `${emp.firstName} ${emp.lastName}`,
        department: emp.department?.name || 'General',
        designation: emp.designation?.title || 'Staff',
        avatarUrl: emp.avatarUrl,
        recordId: null,
        status: 'DRAFT',
        isFinalized: false,
        hasExistingRecord: false,
        isCarriedForward: !!salary, // Carried forward from previous month's setup!
        totalDays: totalDaysInMonth,
        paidDays,
        lopDays: absentDays,
        basicSalary: basic,
        hra,
        da: 0,
        medicalAllowance: medical,
        otherAllowances: other,
        specialAllowance: special,
        conveyance,
        allowancesEarnings,
        grossEarnings,
        epf,
        professionalTax: pt,
        tds,
        totalDeductions,
        netSalary,
      };
    });

    return {
      period: {
        id: period?.id || null,
        year,
        month,
        status: period?.status || 'DRAFT',
        totalDays: totalDaysInMonth,
        finalizedAt: period?.finalizedAt || null,
      },
      summary: {
        totalEmployees: employees.length,
        finalizedEmployees: finalizedCount,
        pendingEmployees: employees.length - finalizedCount,
        totalGrossPayout: Math.round(totalGrossPayout),
        totalNetPayout: Math.round(totalNetPayout),
        totalDeductions: Math.round(totalDeductionsAmount),
      },
      employees: employeeRows,
    };
  }

  async bulkUploadPayroll(dto: BulkUploadPayrollDto, user: AuthenticatedUser) {
    const targetCompanyId =
      dto.companyId ||
      user.activeCompanyId ||
      user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestException('Target Company ID is required');
    }

    const { year, month, records } = dto;
    if (!records || records.length === 0) {
      throw new BadRequestException('No payroll records provided for upload');
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const totalDaysInMonth = endDate.getDate();

    // 1. Ensure PayrollPeriod exists
    const payrollPeriod = await this.prisma.payrollPeriod.upsert({
      where: {
        companyId_year_month: {
          companyId: targetCompanyId,
          year,
          month,
        },
      },
      update: {
        status: PayrollStatus.PROCESSING,
      },
      create: {
        companyId: targetCompanyId,
        year,
        month,
        startDate,
        endDate,
        totalWorkingDays: totalDaysInMonth,
        status: PayrollStatus.PROCESSING,
      },
    });

    let updatedCount = 0;
    const errors: string[] = [];

    for (const row of records) {
      if (!row.employeeCode) continue;

      const employee = await this.prisma.employee.findFirst({
        where: {
          companyId: targetCompanyId,
          employeeCode: row.employeeCode.trim(),
        },
      });

      if (!employee) {
        errors.push(`Employee code ${row.employeeCode} not found in this company.`);
        continue;
      }

      const basicSalary = Number(row.basicSalary) || 0;
      const hra = Number(row.hra) || 0;
      const conveyance = Number(row.conveyance) || 0;
      const da = Number(row.da) || 0;
      const medical = Number(row.medicalAllowance) || 0;
      const special = Number(row.specialAllowance) || 0;
      const other = Number(row.otherAllowances) || 0;

      const allowancesEarnings = hra + conveyance + da + medical + special + other;
      const grossEarnings = basicSalary + allowancesEarnings;

      const epf = Number(row.epfEmployee) || 0;
      const pt = Number(row.professionalTax) || 0;
      const tds = Number(row.tds) || 0;

      const lopDays = Number(row.lopDays) || 0;
      const perDaySalary = totalDaysInMonth > 0 ? grossEarnings / totalDaysInMonth : 0;
      const lopAmount = Math.round(perDaySalary * lopDays);

      const statutoryDeductions = epf + pt;
      const otherDeductions = tds + lopAmount;
      const totalDeductions = statutoryDeductions + otherDeductions;
      const netSalary = Math.max(0, grossEarnings - totalDeductions);
      const paidDays = Math.max(0, totalDaysInMonth - lopDays);

      await this.prisma.$transaction(async (tx) => {
        // A. Update/create SalaryStructure so it PERMANENTLY carries forward!
        await tx.salaryStructure.updateMany({
          where: { employeeId: employee.id },
          data: { isActive: false },
        });

        await tx.salaryStructure.create({
          data: {
            employeeId: employee.id,
            companyId: employee.companyId,
            effectiveDate: startDate,
            basicSalary,
            hra,
            conveyance,
            medicalAllowance: medical,
            specialAllowance: special,
            otherAllowances: other + da,
            grossMonthly: grossEarnings,
            epfEmployee: epf,
            epfEmployer: epf,
            professionalTax: pt,
            tdsMonthly: tds,
            otherDeductions: 0,
            totalDeductions: statutoryDeductions + tds,
            netMonthly: netSalary,
            ctcAnnual: grossEarnings * 12,
            isActive: true,
          },
        });

        // B. Upsert month's PayrollRecord
        const record = await tx.payrollRecord.upsert({
          where: {
            payrollPeriodId_employeeId_revision: {
              payrollPeriodId: payrollPeriod.id,
              employeeId: employee.id,
              revision: 1,
            },
          },
          update: {
            totalDaysInMonth,
            payableDays: paidDays,
            presentDays: paidDays,
            paidLeaveDays: 0,
            lopDays,
            basicEarnings: basicSalary,
            allowancesEarnings,
            grossEarnings,
            statutoryDeductions,
            otherDeductions,
            totalDeductions,
            netSalary,
            status: PayrollRecordStatus.CALCULATED,
            payslipGenerated: true,
            payslipGeneratedAt: new Date(),
          },
          create: {
            payrollPeriodId: payrollPeriod.id,
            employeeId: employee.id,
            companyId: employee.companyId,
            revision: 1,
            totalDaysInMonth,
            payableDays: paidDays,
            presentDays: paidDays,
            paidLeaveDays: 0,
            lopDays,
            holidayDays: 0,
            weekOffDays: 4,
            basicEarnings: basicSalary,
            allowancesEarnings,
            grossEarnings,
            statutoryDeductions,
            otherDeductions,
            totalDeductions,
            netSalary,
            status: PayrollRecordStatus.CALCULATED,
            payslipGenerated: true,
            payslipGeneratedAt: new Date(),
          },
        });

        // C. Recreate line items
        await tx.payrollLineItem.deleteMany({
          where: { payrollRecordId: record.id },
        });

        const lineItems: Array<{
          payrollRecordId: string;
          type: LineItemType;
          name: string;
          amount: number;
        }> = [
          { payrollRecordId: record.id, type: LineItemType.EARNING, name: 'Basic Salary', amount: basicSalary },
        ];
        if (hra > 0) lineItems.push({ payrollRecordId: record.id, type: LineItemType.EARNING, name: 'House Rent Allowance (HRA)', amount: hra });
        if (da > 0) lineItems.push({ payrollRecordId: record.id, type: LineItemType.EARNING, name: 'Dearness Allowance (DA)', amount: da });
        if (medical > 0) lineItems.push({ payrollRecordId: record.id, type: LineItemType.EARNING, name: 'Medical Allowance', amount: medical });
        if (special > 0) lineItems.push({ payrollRecordId: record.id, type: LineItemType.EARNING, name: 'Special Allowance', amount: special });
        if (other > 0) lineItems.push({ payrollRecordId: record.id, type: LineItemType.EARNING, name: 'Other Allowance', amount: other });
        if (conveyance > 0) lineItems.push({ payrollRecordId: record.id, type: LineItemType.EARNING, name: 'Conveyance Allowance', amount: conveyance });
        if (epf > 0) lineItems.push({ payrollRecordId: record.id, type: LineItemType.DEDUCTION, name: 'Employees Provident Fund (EPF)', amount: epf });
        if (pt > 0) lineItems.push({ payrollRecordId: record.id, type: LineItemType.DEDUCTION, name: 'Professional Tax (PT)', amount: pt });
        if (tds > 0) lineItems.push({ payrollRecordId: record.id, type: LineItemType.DEDUCTION, name: 'TDS / Income Tax', amount: tds });
        if (lopAmount > 0) lineItems.push({ payrollRecordId: record.id, type: LineItemType.DEDUCTION, name: `Loss of Pay (LOP) - ${lopDays} Day(s)`, amount: lopAmount });

        await tx.payrollLineItem.createMany({ data: lineItems });
      });

      updatedCount += 1;
    }

    return {
      success: true,
      updatedCount,
      errors,
      message: `Successfully populated payroll and carried forward salary structure for ${updatedCount} employees.`,
    };
  }

  async finalizeAllPayroll(dto: FinalizeAllPayrollDto, user: AuthenticatedUser) {
    const targetCompanyId =
      dto.companyId ||
      user.activeCompanyId ||
      user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestException('Target Company ID is required');
    }

    const { year, month } = dto;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const totalDaysInMonth = endDate.getDate();

    // 1. Ensure period
    const payrollPeriod = await this.prisma.payrollPeriod.upsert({
      where: {
        companyId_year_month: {
          companyId: targetCompanyId,
          year,
          month,
        },
      },
      update: {
        status: PayrollStatus.FINALIZED,
        finalizedAt: new Date(),
        finalizedById: user.id,
      },
      create: {
        companyId: targetCompanyId,
        year,
        month,
        startDate,
        endDate,
        totalWorkingDays: totalDaysInMonth,
        status: PayrollStatus.FINALIZED,
        finalizedAt: new Date(),
        finalizedById: user.id,
      },
    });

    // 2. Fetch all employees in this company
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: targetCompanyId,
        employmentStatus: { in: ['FULL_TIME', 'PROBATION', 'CONTRACT'] },
      },
      include: {
        salaryStructures: {
          where: { isActive: true },
          orderBy: { effectiveDate: 'desc' },
          take: 1,
        },
        payrollRecords: {
          where: { payrollPeriodId: payrollPeriod.id },
          take: 1,
        },
        attendanceRecords: {
          where: { date: { gte: startDate, lte: endDate } },
        },
      },
    });

    let finalizedCount = 0;

    for (const emp of employees) {
      const existingRecord = emp.payrollRecords[0];

      if (existingRecord) {
        // Mark existing record finalized
        await this.prisma.payrollRecord.update({
          where: { id: existingRecord.id },
          data: {
            status: PayrollRecordStatus.FINALIZED,
            payslipGenerated: true,
            payslipGeneratedAt: new Date(),
          },
        });
        finalizedCount += 1;
      } else {
        // Create finalized record from carried forward salary structure
        const salary = emp.salaryStructures[0];
        const basic = salary ? Number(salary.basicSalary) : 50000;
        const hra = salary ? Number(salary.hra) : 20000;
        const conveyance = salary ? Number(salary.conveyance) : 0;
        const medical = salary ? Number(salary.medicalAllowance) : 1250;
        const special = salary ? Number(salary.specialAllowance) : 0;
        const other = salary ? Number(salary.otherAllowances) : 0;
        const allowances = hra + conveyance + medical + special + other;
        const gross = basic + allowances;

        const epf = salary ? Number(salary.epfEmployee) : 6000;
        const pt = salary ? Number(salary.professionalTax) : 200;
        const tds = salary ? Number(salary.tdsMonthly) : 0;

        const absentDays = emp.attendanceRecords.filter(
          (a) => a.status === AttendanceStatus.ABSENT,
        ).length;
        const perDay = totalDaysInMonth > 0 ? gross / totalDaysInMonth : 0;
        const lopAmount = Math.round(perDay * absentDays);
        const totalDeductions = epf + pt + tds + lopAmount;
        const net = Math.max(0, gross - totalDeductions);
        const payableDays = Math.max(0, totalDaysInMonth - absentDays);

        const newRecord = await this.prisma.payrollRecord.create({
          data: {
            payrollPeriodId: payrollPeriod.id,
            employeeId: emp.id,
            companyId: targetCompanyId,
            revision: 1,
            totalDaysInMonth,
            payableDays,
            presentDays: payableDays,
            paidLeaveDays: 0,
            lopDays: absentDays,
            holidayDays: 0,
            weekOffDays: 4,
            basicEarnings: basic,
            allowancesEarnings: allowances,
            grossEarnings: gross,
            statutoryDeductions: epf + pt,
            otherDeductions: tds + lopAmount,
            totalDeductions,
            netSalary: net,
            status: PayrollRecordStatus.FINALIZED,
            payslipGenerated: true,
            payslipGeneratedAt: new Date(),
          },
        });

        // Add line items
        const lineItems: Array<{
          payrollRecordId: string;
          type: LineItemType;
          name: string;
          amount: number;
        }> = [
          { payrollRecordId: newRecord.id, type: LineItemType.EARNING, name: 'Basic Salary', amount: basic },
        ];
        if (hra > 0) lineItems.push({ payrollRecordId: newRecord.id, type: LineItemType.EARNING, name: 'House Rent Allowance (HRA)', amount: hra });
        if (medical > 0) lineItems.push({ payrollRecordId: newRecord.id, type: LineItemType.EARNING, name: 'Medical Allowance', amount: medical });
        if (conveyance > 0) lineItems.push({ payrollRecordId: newRecord.id, type: LineItemType.EARNING, name: 'Conveyance Allowance', amount: conveyance });
        if (special > 0) lineItems.push({ payrollRecordId: newRecord.id, type: LineItemType.EARNING, name: 'Special Allowance', amount: special });
        if (other > 0) lineItems.push({ payrollRecordId: newRecord.id, type: LineItemType.EARNING, name: 'Other Allowance', amount: other });
        if (epf > 0) lineItems.push({ payrollRecordId: newRecord.id, type: LineItemType.DEDUCTION, name: 'Employees Provident Fund (EPF)', amount: epf });
        if (pt > 0) lineItems.push({ payrollRecordId: newRecord.id, type: LineItemType.DEDUCTION, name: 'Professional Tax (PT)', amount: pt });
        if (tds > 0) lineItems.push({ payrollRecordId: newRecord.id, type: LineItemType.DEDUCTION, name: 'TDS / Income Tax', amount: tds });
        if (lopAmount > 0) lineItems.push({ payrollRecordId: newRecord.id, type: LineItemType.DEDUCTION, name: `Loss of Pay (LOP) - ${absentDays} Day(s)`, amount: lopAmount });

        await this.prisma.payrollLineItem.createMany({ data: lineItems });
        finalizedCount += 1;
      }

      // Notify employee
      await this.prisma.notification.create({
        data: {
          userId: emp.userId,
          companyId: targetCompanyId,
          type: NotificationType.PAYROLL,
          referenceId: payrollPeriod.id,
          title: `Official Payslip Released for ${month}/${year}`,
          message: `Your official payslip for ${month}/${year} has been finalized by HR and is available for viewing and PDF download.`,
        },
      });
    }

    // Audit Log
    await this.prisma.auditLog.create({
      data: {
        companyId: targetCompanyId,
        actorId: user.id,
        actorEmail: user.email,
        action: 'PAYROLL_ALL_FINALIZED',
        entityName: 'PayrollPeriod',
        entityId: payrollPeriod.id,
        afterJson: JSON.stringify({ year, month, finalizedEmployees: finalizedCount }),
        reason: 'Bulk payroll finalized and published by HR',
      },
    });

    return {
      success: true,
      payrollPeriodId: payrollPeriod.id,
      year,
      month,
      finalizedEmployees: finalizedCount,
      message: `Payroll finalized successfully for all ${finalizedCount} employees. Official payslips released.`,
    };
  }

  // ─────────────────────────────────────────────────────────
  // Detail Summary Excel (6-sheet official salary register)
  // ─────────────────────────────────────────────────────────

  async generateDetailSummaryExcelBuffer(
    year: number,
    month: number,
    user: AuthenticatedUser,
    companyIdQuery?: string,
  ): Promise<Buffer> {
    const targetCompanyId =
      companyIdQuery ||
      user.activeCompanyId ||
      user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestException('Company ID is required');
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const totalDaysInMonth = endDate.getDate();

    // Fetch company for display name
    const company = await this.prisma.company.findUnique({
      where: { id: targetCompanyId },
      select: { name: true },
    });

    // Fetch all employees (active + resigned/terminated for FFS)
    const allEmployees = await this.prisma.employee.findMany({
      where: { companyId: targetCompanyId },
      include: {
        department: { select: { name: true } },
        designation: { select: { title: true } },
        officeLocation: { select: { name: true } },
        salaryStructures: {
          where: { isActive: true },
          orderBy: { effectiveDate: 'desc' },
          take: 1,
        },
        payrollRecords: {
          where: {
            payrollPeriod: { year, month },
          },
          include: { lineItems: true },
          take: 1,
        },
      },
      orderBy: { employeeCode: 'asc' },
    });

    // Fetch previous month payroll records for Gross/Net Reco comparison
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevRecords = await this.prisma.payrollRecord.findMany({
      where: {
        companyId: targetCompanyId,
        payrollPeriod: { year: prevYear, month: prevMonth },
      },
      select: {
        employeeId: true,
        grossEarnings: true,
        netSalary: true,
        lopDays: true,
      },
    });
    const prevByEmployee = new Map(prevRecords.map((r) => [r.employeeId, r]));

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const monthLabel = `${shortMonthNames[month - 1]}-${year}`;
    const prevMonthLabel = `${shortMonthNames[prevMonth - 1]}'${String(prevYear).slice(-2)}`;
    const currMonthLabel = `${monthNames[month - 1]}'${String(year).slice(-2)}`;

    const PF_CEILING = 15000;

    const buildRow = (emp: any, slNo: number): DetailSummaryEmployeeRow => {
      const record = emp.payrollRecords[0];
      const salary = emp.salaryStructures[0];

      // Determine if this employee is "Permanent" or "Consultant"
      // CONTRACT employees map to Consultant, FULL_TIME/PROBATION to Permanent
      const jobType =
        emp.employmentStatus === 'CONTRACT' || emp.employmentStatus === 'INTERN'
          ? 'Consultant'
          : 'Permanent';

      // Worked days & LOP
      const workedDays = record ? Number(record.payableDays) : totalDaysInMonth;
      const lopDays = record ? Number(record.lopDays) : 0;

      // Earnings – prefer line items from record, fall back to salary structure
      let basic = 0, hra = 0, conveyance = 0, specialAllow = 0, otherAllow = 0;
      let consultantFee = 0, incentive = 0, allowance = 0;
      let epf = 0, pt = 0, tds = 0;

      if (record) {
        basic = Number(record.basicEarnings);
        const hraItem = record.lineItems.find((l: any) => l.name.includes('HRA'));
        const convItem = record.lineItems.find((l: any) => l.name.toLowerCase().includes('conveyance'));
        const specItem = record.lineItems.find((l: any) => l.name.toLowerCase().includes('special'));
        const daItem = record.lineItems.find((l: any) => l.name.toLowerCase().includes('da') || l.name.toLowerCase().includes('dearness'));
        const medItem = record.lineItems.find((l: any) => l.name.toLowerCase().includes('medical'));
        const otherItem = record.lineItems.find((l: any) => l.name.toLowerCase().includes('other'));
        const incItem = record.lineItems.find((l: any) => l.name.toLowerCase().includes('incentive'));
        const epfItem = record.lineItems.find((l: any) => l.name.toLowerCase().includes('epf') || l.name.toLowerCase().includes('provident'));
        const ptItem = record.lineItems.find((l: any) => l.name.toLowerCase().includes('professional tax') || l.name.toLowerCase().includes(' pt'));
        const tdsItem = record.lineItems.find((l: any) => l.name.toLowerCase().includes('tds'));

        hra = hraItem ? Number(hraItem.amount) : (salary ? Number(salary.hra) : 0);
        conveyance = convItem ? Number(convItem.amount) : (salary ? Number(salary.conveyance) : 0);
        specialAllow = specItem ? Number(specItem.amount) : (salary ? Number(salary.specialAllowance) : 0);
        otherAllow = (daItem ? Number(daItem.amount) : 0) + (medItem ? Number(medItem.amount) : 0);
        incentive = incItem ? Number(incItem.amount) : 0;
        allowance = otherItem ? Number(otherItem.amount) : 0;
        epf = epfItem ? Number(epfItem.amount) : (salary ? Number(salary.epfEmployee) : 0);
        pt = ptItem ? Number(ptItem.amount) : (salary ? Number(salary.professionalTax) : 0);
        tds = tdsItem ? Number(tdsItem.amount) : (salary ? Number(salary.tdsMonthly) : 0);

        // For consultants, move earnings to consultantFee
        if (jobType === 'Consultant' && basic === 0) {
          // total earnings minus line-item deductions = consultant fee
          consultantFee = Number(record.grossEarnings);
          hra = 0; conveyance = 0; specialAllow = 0; otherAllow = 0;
        }
      } else if (salary) {
        basic = Number(salary.basicSalary);
        hra = Number(salary.hra);
        conveyance = Number(salary.conveyance);
        specialAllow = Number(salary.specialAllowance);
        otherAllow = Number(salary.medicalAllowance) + Number(salary.otherAllowances);
        epf = Number(salary.epfEmployee);
        pt = Number(salary.professionalTax);
        tds = Number(salary.tdsMonthly);
        if (jobType === 'Consultant') {
          consultantFee = Number(salary.grossMonthly);
          basic = 0; hra = 0; conveyance = 0; specialAllow = 0; otherAllow = 0;
        }
      }

      const totalEarnings = record
        ? Number(record.grossEarnings)
        : basic + hra + conveyance + specialAllow + otherAllow + consultantFee + incentive + allowance;
      const totalDeductions = record
        ? Number(record.totalDeductions)
        : epf + pt + tds;
      const netPay = record
        ? Number(record.netSalary)
        : Math.max(0, totalEarnings - totalDeductions);

      // CTC
      const epfEmployer = jobType === 'Consultant' ? 0 : Math.round(Math.min(basic + specialAllow, PF_CEILING) * 0.12);
      const monthlyCtc = totalEarnings + epfEmployer;
      const costToCompany = monthlyCtc * 12;
      const fixedCtc = costToCompany;
      const fixedGross = basic + hra + conveyance + specialAllow + otherAllow + consultantFee;
      const proration = workedDays < totalDaysInMonth
        ? Math.round((fixedGross / totalDaysInMonth) * workedDays)
        : fixedGross;
      const ctcDiff = totalEarnings - proration;
      const medicalInsurance = salary
        ? (jobType === 'Permanent' ? 334 : 0) // standard group health
        : 0;

      // Previous month comparison
      const prev = prevByEmployee.get(emp.id);
      const prevGross = prev ? Number(prev.grossEarnings) : totalEarnings;
      const prevNet = prev ? Number(prev.netSalary) : netPay;
      const grossDiff = totalEarnings - prevGross;
      const netDiff = netPay - prevNet;
      const prevLop = prev ? Number(prev.lopDays) : 0;
      let recoRemarks = '';
      if (grossDiff !== 0 && lopDays > prevLop) {
        recoRemarks = `LOP days in ${monthNames[month - 1]}`;
      }

      return {
        slNo,
        code: emp.employeeCode || '',
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        doj: emp.joiningDate
          ? new Date(emp.joiningDate).toLocaleDateString('en-GB').replace(/\//g, '/')
          : '',
        jobType,
        department: emp.department?.name || '',
        designation: emp.designation?.title || '',
        branch: emp.officeLocation?.name || '',
        bankAccountNo: emp.bankAccountNumber || '',
        resignedDate: emp.exitDate
          ? new Date(emp.exitDate).toLocaleDateString('en-GB').replace(/\//g, '/')
          : '',
        relievedDate: emp.exitDate
          ? new Date(emp.exitDate).toLocaleDateString('en-GB').replace(/\//g, '/')
          : '',
        ifscCode: emp.bankIfscCode || '',
        uanNumber: emp.uanNumber || '',
        workedDays,
        lopDays,
        rlopDays: 0,
        basic,
        hra,
        conveyance,
        specialAllowance: specialAllow,
        otherAllowance: otherAllow,
        consultantFee,
        incentive,
        allowance,
        totalEarnings,
        providentFund: epf,
        professionalTax: pt,
        tds,
        totalDeductions,
        netPay,
        remarks: record?.remarks || '',
        // CTC
        costToCompany,
        fixedCtc,
        monthlyCtc,
        epfEmployer,
        fixedGross,
        proration,
        ctcDiff,
        medicalInsurance,
        // Reco
        prevMonthGross: prevGross,
        prevMonthNet: prevNet,
        grossDiff,
        netDiff,
        recoRemarks,
      };
    };

    // Split into active (PAY_Sheet main block) and resigned/FFS (Pay Block FFS)
    const activeStatuses = ['FULL_TIME', 'PROBATION', 'CONTRACT', 'INTERN', 'PART_TIME'];
    const activeEmps = allEmployees.filter((e) => activeStatuses.includes(e.employmentStatus));
    const ffEmps = allEmployees.filter((e) =>
      ['RESIGNED', 'TERMINATED'].includes(e.employmentStatus) && e.payrollRecords.length > 0,
    );

    let slNo = 1;
    const employeeRows: DetailSummaryEmployeeRow[] = activeEmps.map((emp) => buildRow(emp, slNo++));

    slNo = 1;
    const ffRows: DetailSummaryEmployeeRow[] = ffEmps.map((emp) => buildRow(emp, slNo++));

    const summaryData: DetailSummaryData = {
      companyName: company?.name || '',
      monthLabel,
      prevMonthLabel,
      currMonthLabel,
      employees: employeeRows,
      ffEmployees: ffRows,
    };

    return generateDetailSummaryExcel(summaryData);
  }
}

