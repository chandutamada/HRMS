import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateLiveLocationDto,
  SessionSyncRequestDto,
  ToggleWorkLocationDto,
  RoutePointDto,
} from './dto/tracking.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  calculateHaversineDistance,
  isWithinGeofenceRadius,
} from '../common/utils/geofence.util';
import { WorkLocationType } from '@prisma/client';
// Gateway injected optionally to avoid circular dependency at boot
import type { TrackingGateway } from './tracking.gateway';

@Injectable()
export class TrackingService {
  private gateway?: TrackingGateway;

  setGateway(gateway: TrackingGateway) {
    this.gateway = gateway;
  }

  getGateway(): TrackingGateway | undefined {
    return this.gateway;
  }

  constructor(
    private prisma: PrismaService,
  ) {}

  /**
   * Check if given date/time falls within office operating hours.
   * Default: 09:00 AM - 05:30 PM (IST), Monday to Saturday.
   */
  isWithinOfficeHours(shift?: any, date = new Date()): boolean {
    // Convert to Indian Standard Time (UTC+5:30)
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const istDate = new Date(utc + 3600000 * 5.5);

    const dayOfWeek = istDate.getDay(); // 0 is Sunday
    if (dayOfWeek === 0) {
      return false; // Sunday office closed
    }

    const startStr = shift?.startTime || '09:00';
    const endStr = shift?.endTime || '17:30';

    const [startH, startM] = startStr.split(':').map((v: string) => parseInt(v, 10));
    const [endH, endM] = endStr.split(':').map((v: string) => parseInt(v, 10));

    const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Parse numeric timestamp (epoch ms) or ISO string to Date object
   */
  private parseTimestamp(val: number | string | undefined | null): Date {
    if (!val) return new Date();
    if (typeof val === 'number') return new Date(val);
    const num = Number(val);
    if (!isNaN(num) && num > 1000000000) {
      return new Date(num);
    }
    return new Date(val);
  }

  /**
   * Update Live Location for current authenticated user/employee
   */
  async updateLiveLocation(dto: UpdateLiveLocationDto, user: AuthenticatedUser) {
    // 1. Fetch employee record with office location & shift
    let employee = null;
    if (user.employeeId) {
      employee = await this.prisma.employee.findUnique({
        where: { id: user.employeeId },
        include: {
          officeLocation: true,
          shift: true,
        },
      });
    } else {
      employee = await this.prisma.employee.findFirst({
        where: { userId: user.id },
        include: {
          officeLocation: true,
          shift: true,
        },
      });
    }

    // 2. Validate office hours
    const isOfficeHours = this.isWithinOfficeHours(employee?.shift);

    // 2b. For Field employees (OFF_SITE), tracking is active strictly from Punch-In until Punch-Out
    if (employee && employee.workLocationType === 'OFF_SITE') {
      const now = new Date();
      const istDateString = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
      const today = new Date(`${istDateString}T00:00:00.000Z`);

      const todayRecord = await this.prisma.attendanceRecord.findFirst({
        where: { employeeId: employee.id, date: today },
      });

      const isFieldTrackingActive = Boolean(todayRecord?.firstCheckIn && !todayRecord?.lastCheckOut);
      if (!isFieldTrackingActive) {
        return {
          success: true,
          trackingActive: false,
          message: 'Field tracking paused: location tracking is active only between punch-in and punch-out.',
        };
      }
    }

    // 3. Calculate distance to office & geofence validation
    let isWithinGeofence = false;
    let distanceToOfficeMeters: number | null = null;

    if (employee?.officeLocation) {
      const office = employee.officeLocation;
      const officeLat = Number(office.latitude);
      const officeLon = Number(office.longitude);
      const radius = office.radiusMeters || 50;

      const geo = isWithinGeofenceRadius(
        dto.latitude,
        dto.longitude,
        officeLat,
        officeLon,
        radius,
      );
      isWithinGeofence = geo.isWithin;
      distanceToOfficeMeters = geo.distanceMeters;
    }

    // 4. Upsert Live Location record
    const isMoving =
      dto.isMoving !== undefined
        ? dto.isMoving
        : dto.speed !== undefined && dto.speed > 0.5;

    const liveLoc = await this.prisma.liveLocation.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        employeeId: employee?.id || null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy ?? null,
        altitude: dto.altitude ?? null,
        speed: dto.speed ?? null,
        heading: dto.heading ?? null,
        isMoving,
        batteryLevel: dto.batteryLevel ?? null,
        isWithinOfficeHours: isOfficeHours,
        isWithinGeofence,
        distanceToOfficeMeters,
      },
      update: {
        employeeId: employee?.id || null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy ?? null,
        altitude: dto.altitude ?? null,
        speed: dto.speed ?? null,
        heading: dto.heading ?? null,
        isMoving,
        batteryLevel: dto.batteryLevel ?? null,
        isWithinOfficeHours: isOfficeHours,
        isWithinGeofence,
        distanceToOfficeMeters,
        updatedAt: new Date(),
      },
    });

    // 5. Geofence Breach Detection & HR Notification for On-Site Personnel
    const isBreach =
      Boolean(employee?.officeLocation) &&
      isOfficeHours &&
      !isWithinGeofence &&
      (distanceToOfficeMeters || 0) > (employee?.officeLocation?.radiusMeters || 50);

    if (isBreach && employee) {
      await this.handleGeofenceBreachNotification(employee, distanceToOfficeMeters || 0);
    }

    // 6b. Broadcast via WebSocket to HR dashboard in real-time (HTTP fallback path)
    if (this.gateway && employee?.companyId) {
      this.gateway.broadcastLocationUpdate(employee.companyId, {
        employeeId: employee.id,
        userId: user.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        speed: dto.speed,
        heading: dto.heading,
        batteryLevel: dto.batteryLevel,
        isMoving: isMoving,
        isWithinGeofence,
        isWithinOfficeHours: isOfficeHours,
        distanceToOfficeMeters,
        timestamp: new Date().toISOString(),
      });
    }

    // 6. Accumulate real GPS point to today's active TrackingSession
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      let activeSession = await this.prisma.trackingSession.findFirst({
        where: {
          userId: user.id,
          startTime: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { startTime: 'desc' },
        include: {
          routePoints: { orderBy: { timestamp: 'desc' }, take: 1 },
        },
      });

      if (!activeSession) {
        const todayIso = now.toISOString().split('T')[0];
        activeSession = await this.prisma.trackingSession.create({
          data: {
            id: `session_${user.id}_${todayIso}`,
            userId: user.id,
            employeeId: employee?.id || null,
            companyId: user.companyId || null,
            startTime: now,
            distanceKm: 0.0,
            isOfficeHours,
          },
          include: {
            routePoints: { orderBy: { timestamp: 'desc' }, take: 1 },
          },
        });
      }

      const lastPoint = activeSession.routePoints?.[0];
      let shouldRecordPoint = true;
      let addedKm = 0;

      if (lastPoint) {
        const distMeters = calculateHaversineDistance(
          lastPoint.latitude,
          lastPoint.longitude,
          dto.latitude,
          dto.longitude,
        );
        // Sanity check: If distance is less than 8 meters, throttle to save space.
        // If distance is > 100 km, it's a simulated jump/teleport anomaly—do not corrupt real field route!
        if (distMeters < 8 || distMeters > 100000) {
          shouldRecordPoint = false;
        } else {
          addedKm = distMeters / 1000;
        }
      }

      if (shouldRecordPoint) {
        await this.prisma.routePoint.create({
          data: {
            sessionId: activeSession.id,
            latitude: dto.latitude,
            longitude: dto.longitude,
            altitude: dto.altitude ?? null,
            speed: dto.speed ?? null,
            accuracy: dto.accuracy ?? null,
            timestamp: now,
          },
        });

        if (addedKm > 0) {
          await this.prisma.trackingSession.update({
            where: { id: activeSession.id },
            data: {
              distanceKm: { increment: addedKm },
              updatedAt: now,
            },
          });
        }
      }
    } catch (e) {
      // Non-blocking log if session storage fails
      console.warn('Failed to append route breadcrumb point:', e);
    }

    return {
      success: true,
      data: liveLoc,
      meta: {
        employeeName: employee ? `${employee.firstName} ${employee.lastName}` : user.email,
        workLocationType: employee?.workLocationType || WorkLocationType.ON_SITE,
        isWithinOfficeHours: isOfficeHours,
        isWithinGeofence,
        distanceToOfficeMeters,
        officeName: employee?.officeLocation?.name || 'Superbee Aeronautics HQ',
      },
    };
  }

  /**
   * Get all live locations for HR Monitoring Dashboard
   * Supports filtering by workLocationType (ON_SITE / OFF_SITE)
   */
  async getAllLiveLocations(
    user: AuthenticatedUser,
    filter?: { workLocationType?: WorkLocationType; search?: string; companyId?: string },
  ) {
    const targetCompanyId = filter?.companyId || user.activeCompanyId || (user.isSuperAdmin ? undefined : user.companyId);
    const whereClause: any = {};
    if (targetCompanyId) {
      whereClause.companyId = targetCompanyId;
    }
    if (filter?.workLocationType) {
      whereClause.workLocationType = filter.workLocationType;
    }
    if (filter?.search) {
      whereClause.OR = [
        { firstName: { contains: filter.search } },
        { lastName: { contains: filter.search } },
        { employeeCode: { contains: filter.search } },
        { email: { contains: filter.search } },
      ];
    }

    const employees = await this.prisma.employee.findMany({
      where: whereClause,
      include: {
        liveLocation: true,
        officeLocation: true,
        shift: true,
        department: true,
        designation: true,
        trackingSessions: {
          orderBy: { startTime: 'desc' },
          take: 1,
          include: {
            _count: {
              select: {
                routePoints: true,
                checkpoints: true,
              },
            },
          },
        },
      },
      orderBy: { employeeCode: 'asc' },
    });

    const isOfficeHoursActive = this.isWithinOfficeHours();

    // Map employees to rich HR view
    const mapped = employees.map((emp) => {
      const live = emp.liveLocation;
      const latestSession = emp.trackingSessions?.[0] || null;

      // Determine active status: updated within last 15 minutes
      const now = Date.now();
      const lastUpdate = live?.updatedAt ? new Date(live.updatedAt).getTime() : 0;
      const isOnline = now - lastUpdate < 15 * 60 * 1000;

      return {
        id: emp.id,
        userId: emp.userId,
        employeeCode: emp.employeeCode,
        fullName: `${emp.firstName} ${emp.lastName}`,
        email: emp.email,
        phone: emp.phone,
        avatarUrl: emp.avatarUrl,
        department: emp.department?.name || 'Engineering',
        designation: emp.designation?.title || 'Flight Operations Specialist',
        workLocationType: emp.workLocationType,
        isOnline,
        lastSeenAt: live?.updatedAt || null,
        office: emp.officeLocation
          ? {
              id: emp.officeLocation.id,
              name: emp.officeLocation.name,
              latitude: Number(emp.officeLocation.latitude),
              longitude: Number(emp.officeLocation.longitude),
              radiusMeters: emp.officeLocation.radiusMeters || 50,
            }
          : null,
        liveLocation: live
          ? {
              latitude: live.latitude,
              longitude: live.longitude,
              accuracy: live.accuracy,
              altitude: live.altitude,
              speed: live.speed,
              heading: live.heading,
              isMoving: live.isMoving,
              batteryLevel: live.batteryLevel,
              isWithinOfficeHours: live.isWithinOfficeHours,
              isWithinGeofence: live.isWithinGeofence,
              distanceToOfficeMeters: live.distanceToOfficeMeters,
              updatedAt: live.updatedAt,
            }
          : null,
        latestSession: latestSession
          ? {
              id: latestSession.id,
              startTime: latestSession.startTime,
              endTime: latestSession.endTime,
              distanceKm: latestSession.distanceKm,
              areaName: latestSession.areaName,
              state: latestSession.state,
              isOfficeHours: latestSession.isOfficeHours,
              pointsCount: latestSession._count?.routePoints || 0,
              checkpointsCount: latestSession._count?.checkpoints || 0,
            }
          : null,
      };
    });

    // Compute aggregate statistics
    const totalEmployees = mapped.length;
    const onSiteEmployees = mapped.filter((e) => e.workLocationType === WorkLocationType.ON_SITE);
    const offSiteEmployees = mapped.filter((e) => e.workLocationType === WorkLocationType.OFF_SITE);

    const insideGeofenceCount = onSiteEmployees.filter(
      (e) => e.liveLocation?.isWithinGeofence,
    ).length;
    const outsideGeofenceCount = onSiteEmployees.length - insideGeofenceCount;

    const activeFieldRoutesCount = offSiteEmployees.filter(
      (e) => e.isOnline && e.latestSession && !e.latestSession.endTime,
    ).length;

    return {
      stats: {
        totalEmployees,
        onSiteCount: onSiteEmployees.length,
        offSiteCount: offSiteEmployees.length,
        insideGeofenceCount,
        outsideGeofenceCount,
        activeFieldRoutesCount,
        isOfficeHoursActive,
        officeWorkingHoursText: '09:00 AM – 05:30 PM (IST)',
      },
      employees: mapped,
    };
  }

  /**
   * Sync Field Tracking Session (Route Points & Checkpoints)
   */
  async batchSyncBreadcrumbs(points: any[], user: AuthenticatedUser) {
    if (!points || points.length === 0) {
      return { success: true, count: 0, message: 'No points to sync' };
    }

    const routePoints: RoutePointDto[] = points.map((p) => ({
      lat: Number(p.latitude ?? p.lat),
      lng: Number(p.longitude ?? p.lng),
      alt: p.altitude != null ? Number(p.altitude) : (p.alt != null ? Number(p.alt) : undefined),
      speed: p.speed != null ? Number(p.speed) : undefined,
      accuracy: p.accuracy != null ? Number(p.accuracy) : undefined,
      heading: p.heading != null ? Number(p.heading) : undefined,
      ts: p.timestamp ? (typeof p.timestamp === 'number' ? p.timestamp : new Date(p.timestamp).getTime()) : Date.now(),
    }));

    const sessionId = `batch-${user.id}-${Date.now()}`;
    return this.syncSession({
      id: sessionId,
      startTime: routePoints[0].ts,
      endTime: routePoints[routePoints.length - 1].ts,
      distanceKm: 0,
      areaName: 'Batch Offline Sync',
      state: 'Synced',
      routePoints,
      checkpoints: [],
    }, user);
  }

  async syncSession(dto: SessionSyncRequestDto, user: AuthenticatedUser) {
    let employee = null;
    if (user.employeeId) {
      employee = await this.prisma.employee.findUnique({
        where: { id: user.employeeId },
      });
    } else {
      employee = await this.prisma.employee.findFirst({
        where: { userId: user.id },
      });
    }

    const startTime = this.parseTimestamp(dto.startTime);
    const endTime = dto.endTime ? this.parseTimestamp(dto.endTime) : null;
    const isOfficeHours = this.isWithinOfficeHours(undefined, startTime);

    return this.prisma.$transaction(async (tx) => {
      // 1. Upsert TrackingSession
      const session = await tx.trackingSession.upsert({
        where: { id: dto.id },
        create: {
          id: dto.id,
          userId: user.id,
          employeeId: employee?.id || null,
          companyId: user.companyId || null,
          startTime,
          endTime,
          distanceKm: dto.distanceKm ?? 0.0,
          areaName: dto.areaName ?? null,
          state: dto.state ?? null,
          isOfficeHours,
        },
        update: {
          endTime,
          distanceKm: dto.distanceKm ?? 0.0,
          areaName: dto.areaName ?? null,
          state: dto.state ?? null,
          isOfficeHours,
          updatedAt: new Date(),
        },
      });

      // 2. Wipe previous points & checkpoints if this is an incremental/final update
      await tx.routePoint.deleteMany({ where: { sessionId: session.id } });
      await tx.checkpoint.deleteMany({ where: { sessionId: session.id } });

      // 3. Bulk insert Route Points
      if (dto.routePoints && dto.routePoints.length > 0) {
        const pointsData = dto.routePoints.map((pt) => ({
          sessionId: session.id,
          latitude: pt.lat,
          longitude: pt.lng,
          altitude: pt.alt ?? null,
          speed: pt.speed ?? null,
          accuracy: pt.accuracy ?? null,
          timestamp: this.parseTimestamp(pt.ts),
        }));

        await tx.routePoint.createMany({
          data: pointsData,
        });
      }

      // 4. Bulk insert Checkpoints / Stops
      if (dto.checkpoints && dto.checkpoints.length > 0) {
        const checkpointsData = dto.checkpoints.map((cp, idx) => ({
          sessionId: session.id,
          latitude: cp.lat,
          longitude: cp.lng,
          arrivedAt: this.parseTimestamp(cp.arrivedAt),
          departedAt: cp.departedAt ? this.parseTimestamp(cp.departedAt) : null,
          pointIndex: cp.index ?? idx,
          notes: cp.notes ?? null,
        }));

        await tx.checkpoint.createMany({
          data: checkpointsData,
        });
      }

      return {
        success: true,
        sessionId: session.id,
        distanceKm: session.distanceKm,
        isOfficeHours,
        routePointsCount: dto.routePoints?.length || 0,
        checkpointsCount: dto.checkpoints?.length || 0,
      };
    });
  }

  /**
   * Get all tracking sessions for a user or all users (HR view)
   */
  async getSessions(user: AuthenticatedUser, targetUserId?: string, targetCompanyId?: string) {
    const isHrOrAdmin =
      user.isSuperAdmin ||
      user.roles.includes('SUPER_ADMIN') ||
      user.roles.includes('HR_ADMIN') ||
      user.roles.includes('HR_MANAGER');

    const effectiveCompanyId = targetCompanyId || user.activeCompanyId || (user.isSuperAdmin ? undefined : user.companyId);

    const where: any = {};
    if (effectiveCompanyId) {
      where.companyId = effectiveCompanyId;
    }
    if (!isHrOrAdmin || targetUserId) {
      where.userId = isHrOrAdmin && targetUserId ? targetUserId : user.id;
    }

    const sessions = await this.prisma.trackingSession.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workLocationType: true,
          },
        },
        _count: {
          select: {
            routePoints: true,
            checkpoints: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
      take: 50,
    });

    return sessions;
  }

  /**
   * Get full details of a specific tracking session with all route points and checkpoints
   */
  async getSessionById(sessionId: string, user: AuthenticatedUser) {
    const session = await this.prisma.trackingSession.findUnique({
      where: { id: sessionId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workLocationType: true,
            officeLocation: true,
          },
        },
        routePoints: {
          orderBy: { timestamp: 'asc' },
        },
        checkpoints: {
          orderBy: { pointIndex: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Tracking session ${sessionId} not found`);
    }

    return session;
  }

  /**
   * Toggle or update employee work location type (ON_SITE vs OFF_SITE)
   */
  async toggleWorkLocation(
    employeeId: string,
    dto: ToggleWorkLocationDto,
    user: AuthenticatedUser,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with id ${employeeId} not found`);
    }

    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        workLocationType: dto.workLocationType,
        employmentType: dto.workLocationType === 'OFF_SITE' ? 'FIELD' : 'OFFICE',
      },
    });

    return {
      success: true,
      employeeId: updated.id,
      employeeCode: updated.employeeCode,
      workLocationType: updated.workLocationType,
      message: `Employee work location updated to ${updated.workLocationType}`,
    };
  }

  /**
   * Dispatches instant geofence breach notifications to HR and system administrators
   * Throttled to 10 minutes per employee to avoid database flooding
   */
  async handleGeofenceBreachNotification(employee: any, distanceMeters: number) {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recentAlert = await this.prisma.notification.findFirst({
        where: {
          referenceId: employee.id,
          title: { contains: 'Geofence Breach' },
          createdAt: { gte: tenMinutesAgo },
        },
      });

      if (recentAlert) {
        return; // Throttled to avoid notification flood
      }

      const empName = `${employee.firstName} ${employee.lastName}`.trim();
      const officeName = employee.officeLocation?.name || 'Assigned Office';
      const radius = employee.officeLocation?.radiusMeters || 50;

      // Find HR and Admin users to alert
      const hrUsers = await this.prisma.user.findMany({
        where: {
          OR: [
            { isSuperAdmin: true },
            {
              companyId: employee.companyId,
              roles: {
                some: {
                  role: {
                    name: { in: ['HR_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN'] },
                  },
                },
              },
            },
          ],
        },
      });

      for (const hr of hrUsers) {
        await this.prisma.notification.create({
          data: {
            userId: hr.id,
            companyId: employee.companyId,
            title: `🚨 Geofence Breach: ${empName}`,
            message: `${empName} (${employee.employeeCode}) has stepped outside ${officeName} (${Math.round(distanceMeters)}m away, allowed radius: ${radius}m) during working hours. Live telemetry tracking is active.`,
            type: 'ATTENDANCE',
            referenceId: employee.id,
          },
        });
      }

      // Log to Audit Trail
      await this.prisma.auditLog.create({
        data: {
          companyId: employee.companyId,
          actorId: employee.userId || null,
          actorEmail: employee.email || null,
          action: 'GEOFENCE_BREACH_DETECTED',
          entityName: 'Employee',
          entityId: employee.id,
          beforeJson: JSON.stringify({
            status: 'INSIDE_OFFICE',
            officeName,
            radiusMeters: radius,
          }),
          afterJson: JSON.stringify({
            status: 'OUTSIDE_OFFICE_BREACH',
            distanceMeters: Math.round(distanceMeters),
            latitude: Number(employee.liveLocation?.latitude || 0),
            longitude: Number(employee.liveLocation?.longitude || 0),
          }),
          reason: `Employee stepped outside office boundary during active shift (${Math.round(distanceMeters)}m away)`,
        },
      });
    } catch (err) {
      console.error('Failed to dispatch geofence breach alert:', err);
    }
  }

  /**
   * HR Simulation endpoint to test geofence breach alert and live tracking
   */
  async simulateGeofenceBreach(targetEmployeeId?: string, user?: AuthenticatedUser) {
    let employee = null;
    if (targetEmployeeId) {
      employee = await this.prisma.employee.findUnique({
        where: { id: targetEmployeeId },
        include: { officeLocation: true, shift: true },
      });
    } else {
      // Pick first on-site employee with an office
      employee = await this.prisma.employee.findFirst({
        where: {
          workLocationType: WorkLocationType.ON_SITE,
          officeLocationId: { not: null },
        },
        include: { officeLocation: true, shift: true },
      });
    }

    if (!employee || !employee.officeLocation) {
      throw new NotFoundException('No employee with assigned office found to simulate geofence breach');
    }

    const office = employee.officeLocation;
    const officeLat = Number(office.latitude);
    const officeLon = Number(office.longitude);

    // Create coordinates ~185m away from office (~0.0016 deg latitude offset)
    const simulatedLat = officeLat + 0.00165;
    const simulatedLon = officeLon + 0.00085;
    const distanceMeters = 185;

    // Upsert live location record
    await this.prisma.liveLocation.upsert({
      where: { userId: employee.userId },
      create: {
        userId: employee.userId,
        employeeId: employee.id,
        latitude: simulatedLat,
        longitude: simulatedLon,
        accuracy: 8.5,
        speed: 1.2,
        isMoving: true,
        isWithinOfficeHours: true,
        isWithinGeofence: false,
        distanceToOfficeMeters: distanceMeters,
      },
      update: {
        latitude: simulatedLat,
        longitude: simulatedLon,
        accuracy: 8.5,
        speed: 1.2,
        isMoving: true,
        isWithinOfficeHours: true,
        isWithinGeofence: false,
        distanceToOfficeMeters: distanceMeters,
        updatedAt: new Date(),
      },
    });

    // Send notifications to HR
    const empName = `${employee.firstName} ${employee.lastName}`.trim();
    const hrUsers = await this.prisma.user.findMany({
      where: {
        OR: [
          { isSuperAdmin: true },
          {
            companyId: employee.companyId,
            roles: {
              some: {
                role: {
                  name: { in: ['HR_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN'] },
                },
              },
            },
          },
        ],
      },
    });

    for (const hr of hrUsers) {
      await this.prisma.notification.create({
        data: {
          userId: hr.id,
          companyId: employee.companyId,
          title: `🚨 Geofence Breach: ${empName}`,
          message: `${empName} (${employee.employeeCode}) has stepped outside ${office.name} (${distanceMeters}m away, allowed radius: ${office.radiusMeters}m) during working hours. Live telemetry tracking is active.`,
          type: 'ATTENDANCE',
          referenceId: employee.id,
        },
      });
    }

    return {
      success: true,
      message: `Geofence breach simulated for ${empName}. Notifications sent to ${hrUsers.length} HR administrators.`,
      employee: {
        id: employee.id,
        fullName: empName,
        employeeCode: employee.employeeCode,
        officeName: office.name,
        simulatedDistanceMeters: distanceMeters,
        coordinates: { latitude: simulatedLat, longitude: simulatedLon },
      },
    };
  }

  /**
   * Get formatted Google Maps Timeline data for an employee on a given date
   */
  async getTimelineData(employeeId: string, dateStr?: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        officeLocation: true,
        department: true,
        designation: true,
        liveLocation: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    // Find real tracking session for this employee on this date
    const session = await this.prisma.trackingSession.findFirst({
      where: {
        employeeId: employee.id,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        routePoints: { orderBy: { timestamp: 'asc' } },
        checkpoints: { orderBy: { pointIndex: 'asc' } },
      },
    });

    // Generate date navigation options (7 recent days: today down to 6 days ago)
    const availableDays = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      availableDays.push({
        date: iso,
        label: `${dayName} ${dayNum}`,
        isToday: i === 0,
        isSelected: iso === (dateStr || today.toISOString().split('T')[0]),
      });
    }

    let stops: any[] = [];
    let transits: any[] = [];
    let routePolyline: Array<[number, number]> = [];

    const hasCheckpoints = Boolean(session && session.checkpoints && session.checkpoints.length > 0);
    const hasRoutePoints = Boolean(session && session.routePoints && session.routePoints.length > 0);

    let tripSummary = {
      title: `Field Mission Route • ${targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`,
      totalPlaces: 0,
      totalDistanceKm: 0,
      totalDurationText: '0 min',
      startTime: null as string | null,
      endTime: null as string | null,
      hasTravelData: false,
    };

    const timezone = employee.officeLocation?.timezone || 'Asia/Kolkata';

    if (hasCheckpoints && session) {
      // Use real recorded checkpoints
      stops = session.checkpoints.map((cp, idx) => {
        const isNearOffice = employee.officeLocation
          ? calculateHaversineDistance(
              Number(cp.latitude),
              Number(cp.longitude),
              Number(employee.officeLocation.latitude),
              Number(employee.officeLocation.longitude)
            ) <= (employee.officeLocation.radiusMeters || 100)
          : false;

        const arriveStr = new Date(cp.arrivedAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: timezone,
        });
        const departStr = cp.departedAt
          ? new Date(cp.departedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: timezone,
            })
          : null;

        return {
          index: idx + 1,
          id: cp.id,
          name: cp.notes || (isNearOffice ? employee.officeLocation!.name : `Waypoint ${idx + 1}`),
          tag: isNearOffice ? 'OFFICE PERIMETER' : (idx === 0 ? 'DEPARTED' : 'WAYPOINT'),
          timestamp: cp.arrivedAt.toISOString(),
          timeRange: departStr ? `${arriveStr} - ${departStr}` : arriveStr,
          durationText: cp.departedAt
            ? `${Math.max(1, Math.round((new Date(cp.departedAt).getTime() - new Date(cp.arrivedAt).getTime()) / (1000 * 60)))} min`
            : 'Active Stay',
          address: cp.notes || `${Number(cp.latitude).toFixed(5)}, ${Number(cp.longitude).toFixed(5)}`,
          latitude: Number(cp.latitude),
          longitude: Number(cp.longitude),
          isOffice: isNearOffice,
        };
      });

      // Calculate real transits between actual stops
      for (let i = 0; i < stops.length - 1; i++) {
        const s1 = stops[i];
        const s2 = stops[i + 1];
        const dist = calculateHaversineDistance(s1.latitude, s1.longitude, s2.latitude, s2.longitude) / 1000;
        transits.push({
          fromStopIndex: s1.index,
          toStopIndex: s2.index,
          mode: dist > 1.5 ? 'DRIVING' : 'WALKING',
          distanceKm: Number(dist.toFixed(1)),
          durationText: `${Math.max(2, Math.round(dist * 3))} min`,
        });
      }

      routePolyline = session.routePoints.map((pt) => [Number(pt.latitude), Number(pt.longitude)]);

      tripSummary = {
        title: `Field Route • ${targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`,
        totalPlaces: stops.length,
        totalDistanceKm: Number((session.distanceKm || 0).toFixed(2)),
        totalDurationText: `${Math.max(1, Math.round((new Date(session.updatedAt).getTime() - new Date(session.startTime).getTime()) / (1000 * 60)))} min`,
        startTime: stops[0]?.timeRange?.split(' - ')?.[0] || null,
        endTime: stops[stops.length - 1]?.timeRange?.split(' - ')?.[1] || null,
        hasTravelData: true,
      };
    } else if (hasRoutePoints && session) {
      // Real route points exist without manual checkpoints: derive real stops from actual points
      const allPoints = session.routePoints;
      const selectedPoints: typeof allPoints = [];
      selectedPoints.push(allPoints[0]);

      for (let i = 1; i < allPoints.length - 1; i++) {
        const prev = selectedPoints[selectedPoints.length - 1];
        const curr = allPoints[i];
        const dist = calculateHaversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
        const timeDiffMins = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / (1000 * 60);
        if (dist >= 50 || timeDiffMins >= 15) {
          selectedPoints.push(curr);
        }
      }

      if (allPoints.length > 1) {
        const last = allPoints[allPoints.length - 1];
        if (selectedPoints[selectedPoints.length - 1].id !== last.id) {
          selectedPoints.push(last);
        }
      }

      stops = selectedPoints.map((pt, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === selectedPoints.length - 1;
        const isNearOffice = employee.officeLocation
          ? calculateHaversineDistance(
              Number(pt.latitude),
              Number(pt.longitude),
              Number(employee.officeLocation.latitude),
              Number(employee.officeLocation.longitude)
            ) <= (employee.officeLocation.radiusMeters || 100)
          : false;

        const exactTime = new Date(pt.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: timezone,
        });

        let tag = 'WAYPOINT';
        let name = isNearOffice ? (employee.officeLocation?.name || 'Office') : `Waypoint ${idx + 1}`;
        if (isStart) {
          tag = isNearOffice ? 'OFFICE PERIMETER' : 'DEPARTED';
          name = isNearOffice ? employee.officeLocation!.name : 'Initial Punch / Departure';
        } else if (isEnd) {
          tag = 'CURRENT POSITION';
          name = isNearOffice ? employee.officeLocation!.name : 'Latest Waypoint';
        }

        return {
          index: idx + 1,
          id: pt.id,
          name,
          tag,
          timestamp: pt.timestamp.toISOString(),
          timeRange: exactTime,
          durationText: isStart ? 'Departure' : (isEnd ? 'Latest Pin' : 'Recorded Pin'),
          address: `${Number(pt.latitude).toFixed(5)}, ${Number(pt.longitude).toFixed(5)}`,
          latitude: Number(pt.latitude),
          longitude: Number(pt.longitude),
          isOffice: isNearOffice,
        };
      });

      // Calculate real transits between actual stops
      for (let i = 0; i < stops.length - 1; i++) {
        const s1 = stops[i];
        const s2 = stops[i + 1];
        const dist = calculateHaversineDistance(s1.latitude, s1.longitude, s2.latitude, s2.longitude) / 1000;
        const durMins = Math.max(1, Math.round((new Date(selectedPoints[i + 1].timestamp).getTime() - new Date(selectedPoints[i].timestamp).getTime()) / (1000 * 60)));
        transits.push({
          fromStopIndex: s1.index,
          toStopIndex: s2.index,
          mode: dist > 1.5 ? 'DRIVING' : 'WALKING',
          distanceKm: Number(dist.toFixed(2)),
          durationText: `${durMins} min`,
        });
      }

      routePolyline = session.routePoints.map((pt) => [Number(pt.latitude), Number(pt.longitude)]);

      const firstTime = selectedPoints[0]
        ? new Date(selectedPoints[0].timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
        : null;
      const lastTime = selectedPoints[selectedPoints.length - 1]
        ? new Date(selectedPoints[selectedPoints.length - 1].timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
        : null;
      const totalDur = selectedPoints.length > 1
        ? Math.max(1, Math.round((new Date(selectedPoints[selectedPoints.length - 1].timestamp).getTime() - new Date(selectedPoints[0].timestamp).getTime()) / (1000 * 60)))
        : 1;

      tripSummary = {
        title: `Field Route • ${targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`,
        totalPlaces: stops.length,
        totalDistanceKm: Number((session.distanceKm || 0).toFixed(2)),
        totalDurationText: `${totalDur} min`,
        startTime: firstTime,
        endTime: lastTime,
        hasTravelData: true,
      };
    } else {
      // ZERO DUMMY DATA: Return empty travel arrays and real live location status
      stops = [];
      transits = [];
      routePolyline = [];
      tripSummary = {
        title: `No Field Travel Recorded • ${targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`,
        totalPlaces: 0,
        totalDistanceKm: 0,
        totalDurationText: '0 min',
        startTime: null,
        endTime: null,
        hasTravelData: false,
      };
    }

    return {
      employee: {
        id: employee.id,
        fullName: `${employee.firstName} ${employee.lastName}`,
        employeeCode: employee.employeeCode,
        avatarUrl: employee.avatarUrl,
        department: employee.department?.name || 'Operations',
        designation: employee.designation?.title || 'Field Specialist',
        workLocationType: employee.workLocationType,
      },
      date: dateStr || today.toISOString().split('T')[0],
      availableDays,
      tripSummary,
      stops,
      transits,
      routePolyline,
      liveLocation: employee.liveLocation
        ? {
            latitude: Number(employee.liveLocation.latitude),
            longitude: Number(employee.liveLocation.longitude),
            accuracy: employee.liveLocation.accuracy,
            speed: employee.liveLocation.speed,
            heading: employee.liveLocation.heading,
            isMoving: employee.liveLocation.isMoving,
            batteryLevel: employee.liveLocation.batteryLevel,
            isWithinOfficeHours: employee.liveLocation.isWithinOfficeHours,
            isWithinGeofence: employee.liveLocation.isWithinGeofence,
            distanceToOfficeMeters: employee.liveLocation.distanceToOfficeMeters,
            updatedAt: employee.liveLocation.updatedAt,
            isOnline: Date.now() - new Date(employee.liveLocation.updatedAt).getTime() < 15 * 60 * 1000,
          }
        : null,
      office: employee.officeLocation
        ? {
            id: employee.officeLocation.id,
            name: employee.officeLocation.name,
            latitude: Number(employee.officeLocation.latitude),
            longitude: Number(employee.officeLocation.longitude),
            radiusMeters: employee.officeLocation.radiusMeters || 50,
            address: employee.officeLocation.address,
          }
        : null,
    };
  }
}
