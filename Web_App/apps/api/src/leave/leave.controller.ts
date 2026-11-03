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
import { LeaveService } from './leave.service';
import {
  ApplyLeaveDto,
  ReviewLeaveDto,
  CreateLeaveTypeDto,
  CalculateLeavePreviewDto,
} from './dto/leave.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LeaveStatus } from '@prisma/client';

@ApiTags('Leave Management')
@Controller('leave')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('types')
  @ApiOperation({ summary: 'List available leave types with entitlements' })
  getTypes(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.leaveService.getLeaveTypes(user, companyId);
  }

  @Post('types')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Configure a new leave type' })
  createType(
    @Body() dto: CreateLeaveTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveService.createLeaveType(dto, user);
  }

  @Get('balances/my')
  @ApiOperation({ summary: 'Get current employee leave balances for the year' })
  getMyBalances(@CurrentUser() user: AuthenticatedUser) {
    return this.leaveService.getMyBalances(user);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply for leave' })
  apply(
    @Body() dto: ApplyLeaveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveService.applyLeave(dto, user);
  }

  @Get('applications/my')
  @ApiOperation({ summary: 'Get current employee leave application history' })
  getMyApplications(@CurrentUser() user: AuthenticatedUser) {
    return this.leaveService.getMyApplications(user);
  }

  @Get('applications')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'List all leave applications with status filter (HR View)' })
  getApplications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('status') status?: LeaveStatus,
  ) {
    return this.leaveService.getApplications(user, { companyId, status });
  }

  @Get('policy-document')
  @ApiOperation({ summary: 'Get official company leave policy document' })
  getPolicyDocument() {
    return this.leaveService.getPolicyDocument();
  }

  @Post('preview')
  @ApiOperation({ summary: 'Calculate effective leave duration and preview sandwich rules' })
  preview(
    @Body() dto: CalculateLeavePreviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveService.calculateLeavePreview(dto, user);
  }

  @Get('encashment-estimate/:employeeId')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Calculate estimated leave encashment for resignation/retirement' })
  getEncashmentEstimate(
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveService.getEncashmentEstimate(employeeId, user);
  }

  @Put('applications/:id/review')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Approve or reject leave application' })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewLeaveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveService.reviewLeave(id, dto, user);
  }
}
