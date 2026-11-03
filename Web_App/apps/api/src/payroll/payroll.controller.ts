import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import {
  ProcessPayrollDto,
  OverridePayrollItemDto,
  CreateSalaryStructureDto,
  GenerateIndividualPayslipDto,
  BulkUploadPayrollDto,
  FinalizeAllPayrollDto,
} from './dto/payroll.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Payroll & Payslips')
@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('monthly-overview')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Get monthly overview of all employees with carried-forward payroll details' })
  getMonthlyOverview(
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const currentMonth = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    return this.payrollService.getMonthlyPayrollOverview(currentYear, currentMonth, user, companyId);
  }

  @Post('bulk-upload')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Bulk populate and carry forward employee payroll details via uploaded Excel/CSV data' })
  bulkUpload(
    @Body() dto: BulkUploadPayrollDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.bulkUploadPayroll(dto, user);
  }

  @Put('finalize-all')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Finalize all employee payslips for the month and publish official payslips' })
  finalizeAll(
    @Body() dto: FinalizeAllPayrollDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.finalizeAllPayroll(dto, user);
  }

  @Post('process')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Calculate and process monthly attendance-linked payroll' })
  processPayroll(
    @Body() dto: ProcessPayrollDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.processPayroll(dto, user);
  }

  @Get('periods')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'List payroll periods with summary statistics' })
  getPeriods(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.payrollService.getPayrollPeriods(user, companyId);
  }

  @Get('periods/:id/records')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Get all employee records for a payroll period' })
  getRecords(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.getPayrollRecords(id, user);
  }

  @Put('periods/:id/finalize')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Finalize payroll and notify employees of payslip availability' })
  finalize(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.finalizePayroll(id, user);
  }

  @Post('individual-generate')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Generate custom payslip for an individual employee with allowances and deductions' })
  generateIndividual(
    @Body() dto: GenerateIndividualPayslipDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.generateIndividualPayslip(dto, user);
  }

  @Put('records/:id/finalize')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Finalize an individual employee payslip record' })
  finalizeRecord(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.finalizeIndividualRecord(id, user);
  }

  @Post('override')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({
    summary: 'Override an individual payroll line item (Requires reason, records audit)',
  })
  overrideItem(
    @Body() dto: OverridePayrollItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.overridePayrollItem(dto, user);
  }

  @Get('payslips/my')
  @ApiOperation({ summary: 'List current employee payslips' })
  getMyPayslips(@CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.getMyPayslips(user);
  }

  @Get('payslips/:recordId/pdf')
  @ApiOperation({ summary: 'Download authenticated private payslip PDF' })
  async downloadPayslipPdf(
    @Param('recordId') recordId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.payrollService.generatePayslipPdf(recordId, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${recordId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  }

  @Post('salary-structure')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Configure or update employee salary structure' })
  saveSalary(
    @Body() dto: CreateSalaryStructureDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.saveSalaryStructure(dto, user);
  }

  @Get('detail-summary/excel')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({
    summary:
      'Download the official 6-sheet Detail Summary Excel (PAY_Sheet, CTC Reco, PT_Reco, PF_Reco, GROSS_Reco, NET_Reco) for a finalized payroll month',
  })
  async downloadDetailSummaryExcel(
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId: string | undefined,
    @Res() res: Response,
  ) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);

    const buffer = await this.payrollService.generateDetailSummaryExcelBuffer(y, m, user, companyId);

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const filename = `Detail_Summary_${monthNames[m - 1]}-${y}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }
}
