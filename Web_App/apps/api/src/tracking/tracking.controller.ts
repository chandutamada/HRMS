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
import { TrackingService } from './tracking.service';
import {
  UpdateLiveLocationDto,
  SessionSyncRequestDto,
  ToggleWorkLocationDto,
} from './dto/tracking.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { WorkLocationType } from '@prisma/client';

@ApiTags('Dual-Employee Tracking & Field Operations')
@Controller('tracking')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('live')
  @ApiOperation({
    summary: 'Update current GPS live location (checks 09:00-17:30 office hours and 50m geofence)',
  })
  updateLive(
    @Body() dto: UpdateLiveLocationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trackingService.updateLiveLocation(dto, user);
  }

  @Get('live')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({
    summary: 'HR Portal: Fetch all active employees (On-Site office vs Off-Site field drone ops)',
  })
  getAllLive(
    @CurrentUser() user: AuthenticatedUser,
    @Query('type') type?: WorkLocationType,
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.trackingService.getAllLiveLocations(user, {
      workLocationType: type,
      search,
      companyId: companyId || user.activeCompanyId || undefined,
    });
  }

  @Post('batch')
  @ApiOperation({
    summary: 'Batch sync buffered offline location breadcrumbs',
  })
  batchSync(
    @Body() dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (dto.routePoints || dto.checkpoints) {
      return this.trackingService.syncSession(dto, user);
    }
    const points = Array.isArray(dto) ? dto : (dto.points || []);
    return this.trackingService.batchSyncBreadcrumbs(points, user);
  }

  @Post('sessions/sync')
  @ApiOperation({
    summary: 'Off-site field workers sync route breadcrumbs and stationary checkpoints',
  })
  syncSession(
    @Body() dto: SessionSyncRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trackingService.syncSession(dto, user);
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'Get tracking session history',
  })
  getSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('userId') userId?: string,
  ) {
    return this.trackingService.getSessions(user, userId);
  }

  @Get('sessions/:id')
  @ApiOperation({
    summary: 'Get complete route points and checkpoints for a specific session',
  })
  getSessionById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trackingService.getSessionById(id, user);
  }

  @Put('employee/:id/work-location')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({
    summary: 'HR toggles employee work location between ON_SITE (Office 50m) and OFF_SITE (Field)',
  })
  toggleWorkLocation(
    @Param('id') employeeId: string,
    @Body() dto: ToggleWorkLocationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trackingService.toggleWorkLocation(employeeId, dto, user);
  }

  @Get('timeline')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({
    summary: 'Get Google Maps Timeline representation of field movement for any employee on a given date',
  })
  getTimeline(
    @Query('employeeId') employeeId: string,
    @Query('date') date?: string,
  ) {
    return this.trackingService.getTimelineData(employeeId, date);
  }

  @Post('simulate-breach')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({
    summary: 'Simulate an office employee stepping out of geofence during work hours to test HR alerts',
  })
  simulateBreach(
    @Body('employeeId') employeeId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.trackingService.simulateGeofenceBreach(employeeId, user);
  }
}

/**
 * Controller matching Spring Boot reference routes exactly:
 * /live-location/me, /live-location/active
 */
@ApiTags('Live Location (Reference Compatible)')
@Controller('live-location')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LiveLocationCompatController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('me')
  @ApiOperation({ summary: 'Employee mobile app sends GPS location here' })
  updateMyLocation(
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const lat = Number(body.latitude ?? body.lat);
    const lng = Number(body.longitude ?? body.lng);
    const accuracy = body.accuracy ? Number(body.accuracy) : undefined;
    const speed = body.speed ? Number(body.speed) : undefined;
    const altitude = body.altitude ?? body.alt ? Number(body.altitude ?? body.alt) : undefined;

    return this.trackingService.updateLiveLocation(
      {
        latitude: lat,
        longitude: lng,
        accuracy,
        speed,
        altitude,
      },
      user,
    );
  }

  @Get('active')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Get all active employee locations for HR live tracking' })
  getActiveLocations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.trackingService.getAllLiveLocations(user, {
      companyId: companyId || user.activeCompanyId || undefined,
    });
  }
}

/**
 * Controller matching Spring Boot reference routes exactly:
 * /sessions/sync, /sessions/user/:userId, /sessions/:sessionId
 */
@ApiTags('Field Sessions (Reference Compatible)')
@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SessionsCompatController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Sync field tracking session' })
  syncSession(
    @Body() dto: SessionSyncRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trackingService.syncSession(dto, user);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get tracking sessions for a user' })
  getUserSessions(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trackingService.getSessions(user, userId);
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get session by id with route points and checkpoints' })
  getSessionById(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trackingService.getSessionById(sessionId, user);
  }
}
