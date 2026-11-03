import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'List employees with pagination and filters' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.employeesService.findAll(user, {
      companyId,
      departmentId,
      search,
      page,
      limit,
    });
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Upload or update avatar photo for the authenticated employee' })
  uploadMyAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: { avatarBase64?: string; filename?: string },
  ) {
    return this.employeesService.updateAvatar(user, {
      buffer: file?.buffer,
      base64: body?.avatarBase64,
      filename: file?.originalname || body?.filename,
      mimeType: file?.mimetype,
    });
  }

  @Post(':id/avatar')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Upload or update avatar photo for a specific employee (Admin)' })
  uploadEmployeeAvatar(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: { avatarBase64?: string; filename?: string },
  ) {
    return this.employeesService.updateAvatar(
      user,
      {
        buffer: file?.buffer,
        base64: body?.avatarBase64,
        filename: file?.originalname || body?.filename,
        mimeType: file?.mimetype,
      },
      id,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed employee profile' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.findOne(id, user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Create and onboard a new employee' })
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.create(dto, user);
  }

  @Post('bulk')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Bulk onboard employees (from Excel/CSV import)' })
  bulkCreate(
    @Body('employees') employees: CreateEmployeeDto[],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.bulkCreate(employees, user);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Update employee details' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.update(id, dto, user);
  }

  @Post(':id/reset-password')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Reset employee password' })
  resetPassword(
    @Param('id') id: string,
    @Body('password') password: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.resetPassword(id, user, password);
  }

  @Post('bulk-shift')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Assign shift to multiple employees' })
  bulkShift(
    @Body('employee_ids') employeeIds: string[],
    @Body('shift_id') shiftId: string | null,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.bulkShift(employeeIds, shiftId, user);
  }

  @Post('sync-attendance')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Sync attendance punches' })
  syncAttendance(@Query('emp_id') empId?: string) {
    return this.employeesService.syncAttendance(empId);
  }

  @Put(':id/toggle-active')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Toggle employee active status' })
  toggleActive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.deactivate(id, user);
  }

  @Delete(':id/permanent')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Permanently delete employee and all records' })
  deletePermanent(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.deletePermanently(id, user);
  }
}
