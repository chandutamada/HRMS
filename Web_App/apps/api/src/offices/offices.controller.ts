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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OfficesService } from './offices.service';
import {
  CreateOfficeDto,
  UpdateOfficeGeofenceDto,
  TestGeofenceDistanceDto,
} from './dto/office.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Offices & Geofencing')
@Controller('offices')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OfficesController {
  constructor(private readonly officesService: OfficesService) {}

  @Get()
  @ApiOperation({ summary: 'List authorized office locations with geofence settings' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.officesService.findAll(user, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get office details with geofence audit history' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.officesService.findOne(id, user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Create new office location with geofence radius' })
  create(@Body() dto: CreateOfficeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.officesService.create(dto, user);
  }

  @Put(':id/geofence')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({
    summary:
      'Update office geofence location and radius (Mandatory reason required, creates audit log)',
  })
  updateGeofence(
    @Param('id') id: string,
    @Body() dto: UpdateOfficeGeofenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.officesService.updateGeofence(id, dto, user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Remove an office location and safely unlink assigned employees' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.officesService.remove(id, user);
  }

  @Post('test-distance')
  @ApiOperation({
    summary: 'Test Haversine distance validation against office coordinates',
  })
  testDistance(@Body() dto: TestGeofenceDistanceDto) {
    return this.officesService.testDistance(dto);
  }

  @Post(':id/assign-me')
  @ApiOperation({
    summary: 'Assign the current user/employee to this office for live geofenced attendance',
  })
  assignMe(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.officesService.assignEmployees(id, [], user);
  }

  @Post(':id/assign-all')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({
    summary: 'Assign all employees to this office location',
  })
  assignAll(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.officesService.assignAllEmployees(id, user);
  }
}
