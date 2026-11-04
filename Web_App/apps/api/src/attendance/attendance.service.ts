import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
  Inject,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import {
  RecordAttendanceEventDto,
  RequestCorrectionDto,
  ReviewCorrectionDto,
  ManualAttendanceOverrideDto,
} from './dto/attendance.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  calculateHaversineDistance,
  isWithinGeofenceRadius,
} from '../common/utils/geofence.util';
import {
  AttendanceStatus,
  AttendanceEventType,
  GeofenceValidationStatus,
  CorrectionStatus,
} from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    @Optional() private trackingGateway?: TrackingGateway,
  ) {}

  /**
   * Alias for punch() required by Enterprise specification
   */
  async punch(dto: RecordAttendanceEventDto, user: AuthenticatedUser) {
    return this.recordAttendanceEvent(dto, user);
  }

  /**
   * Primary Geofenced Attendance Event Submission (Mobile App)
   */
  async recordAttendanceEvent(dto: RecordAttendanceEventDto, user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new BadRequestException('User does not have an associated employee profile');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: {
        officeLocation: true,
        shift: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee record not found');
    }

    let office = employee.officeLocation;
    const shift = employee.shift;

    // Check all authorized company offices if no primary office or to allow multi-office punching
    const allCompanyOffices = employee.companyId
      ? await this.prisma.officeLocation.findMany({
          where: { companyId: employee.companyId },
        })
      : [];

    if (!office && allCompanyOffices.length > 0) {
      office = allCompanyOffices[0];
    }

    if (!office) {
      throw new BadRequestException('Employee does not have an assigned office location');
    }

    let officeLat = Number(office.latitude);
    let officeLon = Number(office.longitude);

    // 1. Calculate Haversine Distance against primary office
    let { isWithin, distanceMeters } = isWithinGeofenceRadius(
      dto.latitude,
      dto.longitude,
      officeLat,
      officeLon,
      office.radiusMeters,
    );

    // If outside primary office, check if employee is at ANY other registered office of this company
    if (!isWithin && allCompanyOffices.length > 1) {
      for (const altOffice of allCompanyOffices) {
        if (altOffice.id === office.id) continue;
        const altLat = Number(altOffice.latitude);
        const altLon = Number(altOffice.longitude);
        const altCheck = isWithinGeofenceRadius(
          dto.latitude,
          dto.longitude,
          altLat,
          altLon,
          altOffice.radiusMeters,
        );
        if (altCheck.isWithin) {
          office = altOffice as any;
          officeLat = altLat;
          officeLon = altLon;
          isWithin = true;
          distanceMeters = altCheck.distanceMeters;
          break;
        }
      }
    }

    // 2. Assess Validation Status
    let validationStatus: GeofenceValidationStatus = GeofenceValidationStatus.VALID;
    let suspiciousDetails: string | null = null;
    
    // Differentiate between OFFICE and FIELD employees
    const employmentType = (employee as any).employmentType || (employee.workLocationType === 'OFF_SITE' ? 'FIELD' : 'OFFICE');
    const isOfficeEmployee = employmentType === 'OFFICE';

    if (dto.isMocked) {
      validationStatus = GeofenceValidationStatus.MOCKED_LOCATION;
      suspiciousDetails = 'Mock location provider detected on Android device';
      throw new BadRequestException('Punch rejected: Mock GPS location provider detected.');
    } else if (dto.accuracyMeters > 100) {
      validationStatus = GeofenceValidationStatus.INACCURATE_GPS;
      suspiciousDetails = `High GPS inaccuracy: ${dto.accuracyMeters}m (Threshold: 100m)`;
    } else if (isOfficeEmployee) {
      // If employmentType === 'OFFICE': Enforce strict office geofence validation via Haversine distance (radius <= 50m). Reject if outside.
      const maxOfficeRadius = Math.min(office.radiusMeters || 50, 50);
      if (distanceMeters > maxOfficeRadius) {
        validationStatus = GeofenceValidationStatus.OUTSIDE_GEOFENCE;
        const actionName = dto.eventType === AttendanceEventType.CHECK_IN ? 'punch in' : 'punch out';
        throw new BadRequestException(
          `Punch rejected: You are outside the strict office geofence perimeter (${Math.round(distanceMeters)}m from ${office.name}, maximum allowed radius: ${maxOfficeRadius}m). Office employees must ${actionName} from inside the office boundary.`,
        );
      }
    } else {
      // If employmentType === 'FIELD': Bypass office geofence radius validation.
      validationStatus = GeofenceValidationStatus.VALID;
    }

    const now = new Date();
    const istDateString = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const today = new Date(`${istDateString}T00:00:00.000Z`);

    // 3. Find or Create AttendanceRecord for Today
    let attendanceRecord = await this.prisma.attendanceRecord.findFirst({
      where: {
        employeeId: employee.id,
        date: today,
      },
    });

    if (!attendanceRecord) {
      try {
        attendanceRecord = await this.prisma.attendanceRecord.create({
          data: {
            employeeId: employee.id,
            companyId: employee.companyId,
            date: today,
            status: AttendanceStatus.ABSENT,
          },
        });
      } catch (_) {
        attendanceRecord = await this.prisma.attendanceRecord.findFirst({
          where: {
            employeeId: employee.id,
            date: today,
          },
        });
      }
    }

    if (!attendanceRecord) {
      throw new BadRequestException('Unable to initialize daily attendance record');
    }

    // 4. Process face photo if provided
    let photoUrlToSave: string | null = null;
    if (dto.photoUrl) {
      if (dto.photoUrl.startsWith('data:image/') || dto.photoUrl.length > 500) {
        try {
          const uploadsAttendanceDir = path.join(process.cwd(), 'uploads', 'attendance');
          if (!fs.existsSync(uploadsAttendanceDir)) {
            fs.mkdirSync(uploadsAttendanceDir, { recursive: true });
          }
          let rawBase64 = dto.photoUrl;
          let ext = 'jpg';
          const match = rawBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
          if (match) {
            ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
            rawBase64 = match[2];
          }
          const filename = `face-${employee.id}-${Date.now()}.${ext}`;
          const filePath = path.join(uploadsAttendanceDir, filename);
          await fs.promises.writeFile(filePath, Buffer.from(rawBase64, 'base64'));
          photoUrlToSave = `/uploads/attendance/${filename}`;
        } catch (err) {
          photoUrlToSave = 'face_verified';
        }
      } else {
        photoUrlToSave = dto.photoUrl;
      }
    }

    let eventRemarks = photoUrlToSave
      ? `${dto.remarks || 'Mobile Punch'} [FacePhoto: ${photoUrlToSave}]`
      : (dto.remarks || 'Mobile Punch');

    if (dto.batteryPercentage != null) {
      eventRemarks += ` [Battery: ${dto.batteryPercentage}%]`;
    }

    // Save the event in database
    const event = await this.prisma.attendanceEvent.create({
      data: {
        attendanceRecordId: attendanceRecord.id,
        employeeId: employee.id,
        officeLocationId: office.id,
        eventType: dto.eventType,
        timestamp: now,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters,
        isWithinGeofence: isWithin,
        distanceMeters,
        validationStatus,
        isMocked: dto.isMocked || false,
        suspiciousDetails,
        deviceModel: dto.deviceModel,
        osVersion: dto.osVersion,
        remarks: eventRemarks,
      },
    });

    // 4b. Update real-time live location in database with phone's real GPS fix and battery
    try {
      await this.prisma.liveLocation.upsert({
        where: { userId: user.id },
        update: {
          employeeId: employee.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracyMeters,
          batteryLevel: dto.batteryPercentage != null ? Number(dto.batteryPercentage) : undefined,
          isWithinGeofence: isWithin,
          distanceToOfficeMeters: distanceMeters,
          updatedAt: now,
        },
        create: {
          employeeId: employee.id,
          userId: user.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracyMeters,
          batteryLevel: dto.batteryPercentage != null ? Number(dto.batteryPercentage) : undefined,
          isWithinGeofence: isWithin,
          distanceToOfficeMeters: distanceMeters,
          updatedAt: now,
        },
      });

      if (this.trackingGateway && employee.companyId) {
        this.trackingGateway.broadcastLocationUpdate(employee.companyId, {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          employeeCode: employee.employeeCode,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracyMeters,
          isWithinGeofence: isWithin,
          distanceToOfficeMeters: distanceMeters,
          eventType: dto.eventType,
          timestamp: now.toISOString(),
        });
      }
    } catch (_) {}

    // 5. Handle CHECK_IN
    if (dto.eventType === AttendanceEventType.CHECK_IN) {
      if (!dto.photoUrl || dto.photoUrl.trim() === '') {
        throw new BadRequestException('A selfie photo is required for punch-in verification.');
      }
      const shiftStartTimeStr = shift?.startTime || '09:00';
      const shiftEndTimeStr = shift?.endTime || '17:30';
      const istTimeFormatted = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
      });

      if (attendanceRecord.firstCheckIn) {
        const prevCheckInTime = attendanceRecord.firstCheckIn.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
        });
        const isLate = attendanceRecord.isLate;
        const lateMinutes = attendanceRecord.lateMinutes;

        return {
          success: true,
          eventType: dto.eventType,
          time: prevCheckInTime,
          officeName: office.name,
          distanceMeters,
          radiusMeters: office.radiusMeters,
          isWithinGeofence: isWithin,
          validationStatus,
          isLate,
          lateMinutes,
          timingStatus: isLate ? 'LATE' : 'ON_TIME',
          timingMessage: isLate
            ? `Late by ${lateMinutes} mins (Shift begins at ${shiftStartTimeStr})`
            : `On Time: Checked in at ${prevCheckInTime} within shift hours (${shiftStartTimeStr} - ${shiftEndTimeStr}).`,
          batteryPercentage: dto.batteryPercentage,
          status: attendanceRecord.status,
          message: `Already checked in today at ${prevCheckInTime}.`,
        };
      }

      // Late Calculation based on shift start (09:00 default) and grace period (30 mins)
      const istHours = Number(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
        }),
      );
      const istMinutes = Number(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          minute: '2-digit',
        }),
      );
      const checkInMinutesOfDay = istHours * 60 + istMinutes;

      // Default shift: 09:00 (540m) + grace 30m = 570m (09:30 AM)
      const shiftStartMinutes = shift
        ? parseInt(shift.startTime.split(':')[0]) * 60 + parseInt(shift.startTime.split(':')[1])
        : 540;
      const gracePeriod = shift?.gracePeriodMinutes || 30;
      const lateThreshold = shiftStartMinutes + gracePeriod;

      const isLate = checkInMinutesOfDay > lateThreshold;
      const lateMinutes = isLate ? checkInMinutesOfDay - shiftStartMinutes : 0;

      const timingMessage = isLate
        ? `Late Arrival: Punched in at ${istTimeFormatted} (${lateMinutes} mins late, Shift begins at ${shiftStartTimeStr})`
        : `On Time: Punched in at ${istTimeFormatted} within shift hours (${shiftStartTimeStr} - ${shiftEndTimeStr}). Have a productive day!`;

      const geofenceRemark = isWithin
        ? (isLate ? `Late check-in by ${lateMinutes} minutes (Grace: ${gracePeriod}m)` : 'On-time check-in within geofence')
        : `Check-in recorded outside 50m geofence (${Math.round(distanceMeters)}m from ${office.name})`;

      const updatedRecord = await this.prisma.attendanceRecord.update({
        where: { id: attendanceRecord.id },
        data: {
          firstCheckIn: now,
          status: AttendanceStatus.PRESENT,
          isLate,
          lateMinutes,
          remarks: `${geofenceRemark} [${timingMessage}]`,
        },
      });

      // If employmentType === 'FIELD': Record punch-in coordinates as their starting point
      if (!isOfficeEmployee) {
        try {
          const todayIso = now.toISOString().split('T')[0];
          const sessionId = `session_${user.id}_${todayIso}`;
          const session = await this.prisma.trackingSession.upsert({
            where: { id: sessionId },
            create: {
              id: sessionId,
              userId: user.id,
              employeeId: employee.id,
              companyId: employee.companyId,
              startTime: now,
              distanceKm: 0.0,
              areaName: 'Field Operations - Day Start',
              state: 'Active Duty',
              isOfficeHours: true,
            },
            update: {
              startTime: now,
              updatedAt: now,
            },
          });

          await this.prisma.routePoint.create({
            data: {
              sessionId: session.id,
              userId: user.id,
              latitude: dto.latitude,
              longitude: dto.longitude,
              accuracy: dto.accuracyMeters,
              speed: 0,
              timestamp: now,
            },
          });

          await this.prisma.checkpoint.create({
            data: {
              sessionId: session.id,
              latitude: dto.latitude,
              longitude: dto.longitude,
              arrivedAt: now,
              pointIndex: 1,
              notes: 'Field Departure / Starting Point',
            },
          });
        } catch (sessionErr) {
          console.error('Failed to record field starting point:', sessionErr);
        }
      }

      const eventResult = {
        success: true,
        eventType: dto.eventType,
        time: istTimeFormatted,
        officeName: office.name,
        distanceMeters,
        radiusMeters: office.radiusMeters,
        isWithinGeofence: isWithin,
        validationStatus,
        isLate,
        lateMinutes,
        timingStatus: isLate ? 'LATE' : 'ON_TIME',
        timingMessage,
        batteryPercentage: dto.batteryPercentage,
        status: updatedRecord.status,
        message: isWithin
          ? `${timingMessage} (Geofence verified: ${office.name})`
          : `Punch recorded (Warning: ${Math.round(distanceMeters)}m from ${office.name}). ${timingMessage}`,
      };

      return {
        ...eventResult,
        data: eventResult,
      };
    }

    // 6. Handle CHECK_OUT
    if (dto.eventType === AttendanceEventType.CHECK_OUT) {
      if (!attendanceRecord.firstCheckIn) {
        throw new BadRequestException('Cannot punch out before punching in for the day');
      }

      if (isOfficeEmployee && !isWithin) {
        throw new BadRequestException(
          `Punch-out rejected: You must be inside the office geofence perimeter to punch out (${Math.round(distanceMeters)}m from ${office.name}, allowed radius: ${office.radiusMeters}m).`,
        );
      }

      const diffMs = now.getTime() - attendanceRecord.firstCheckIn.getTime();
      const totalWorkMinutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(totalWorkMinutes / 60);
      const mins = totalWorkMinutes % 60;
      const totalWorkingHoursFormatted = `${hours} hrs ${mins} mins`;

      const updatedRecord = await this.prisma.attendanceRecord.update({
        where: { id: attendanceRecord.id },
        data: {
          lastCheckOut: now,
          totalWorkMinutes,
          remarks: `Total working hours: ${hours}h ${mins}m${!isWithin ? ` [Outside geofence: ${Math.round(distanceMeters)}m]` : ''}${dto.batteryPercentage != null ? ` [Battery: ${dto.batteryPercentage}%]` : ''}`,
        },
      });

      const checkOutResult = {
        success: true,
        eventType: dto.eventType,
        time: now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
        officeName: office.name,
        distanceMeters,
        radiusMeters: office.radiusMeters,
        isWithinGeofence: isWithin,
        validationStatus,
        totalWorkMinutes,
        totalWorkingHoursFormatted,
        batteryPercentage: dto.batteryPercentage,
        message: `Punched Out Successfully! Today's Total Working Hours: ${totalWorkingHoursFormatted}.`,
      };

      return {
        ...checkOutResult,
        data: checkOutResult,
      };
    }
  }

  /**
   * Get Today's Attendance State for Employee App
   */
  async getTodayStatus(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new BadRequestException('No employee profile associated');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: {
        officeLocation: true,
        shift: true,
      },
    });

    const now = new Date();
    const istDateString = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const today = new Date(`${istDateString}T00:00:00.000Z`);

    const record = await this.prisma.attendanceRecord.findFirst({
      where: {
        employeeId: user.employeeId,
        date: today,
      },
      include: {
        events: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    return {
      date: istDateString,
      employeeName: `${employee?.firstName} ${employee?.lastName}`,
      employeeCode: employee?.employeeCode,
      office: employee?.officeLocation
        ? {
            id: employee.officeLocation.id,
            name: employee.officeLocation.name,
            address: employee.officeLocation.address,
            latitude: Number(employee.officeLocation.latitude),
            longitude: Number(employee.officeLocation.longitude),
            radiusMeters: employee.officeLocation.radiusMeters,
          }
        : null,
      availableOffices: employee?.companyId
        ? (
            await this.prisma.officeLocation.findMany({
              where: { companyId: employee.companyId },
              select: {
                id: true,
                name: true,
                code: true,
                address: true,
                latitude: true,
                longitude: true,
                radiusMeters: true,
              },
            })
          ).map((o) => ({
            ...o,
            latitude: Number(o.latitude),
            longitude: Number(o.longitude),
          }))
        : [],
      shift: employee?.shift
        ? {
            name: employee.shift.name,
            startTime: employee.shift.startTime,
            endTime: employee.shift.endTime,
            gracePeriodMinutes: employee.shift.gracePeriodMinutes,
          }
        : null,
      isCheckedIn: !!record?.firstCheckIn,
      isCheckedOut: !!record?.lastCheckOut,
      hasCheckedIn: !!record?.firstCheckIn,
      hasCheckedOut: !!record?.lastCheckOut,
      firstCheckIn: record?.firstCheckIn || null,
      lastCheckOut: record?.lastCheckOut || null,
      status: record?.status || 'ABSENT',
      isLate: record?.isLate || false,
      lateMinutes: record?.lateMinutes || 0,
      totalWorkMinutes: record?.totalWorkMinutes || 0,
      events:
        record?.events.map((e) => {
          const hasPhoto = e.remarks?.includes('[FacePhoto: ');
          const photoUrl = hasPhoto ? e.remarks!.split('[FacePhoto: ')[1].split(']')[0] : null;
          return {
            ...e,
            latitude: Number(e.latitude),
            longitude: Number(e.longitude),
            distanceMeters: Number(e.distanceMeters),
            photoUrl,
          };
        }) || [],
    };
  }

  /**
   * Attendance History (for Employee or HR)
   */
  async getAttendanceHistory(
    user: AuthenticatedUser,
    params: {
      employeeId?: string;
      companyId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const isHrOrAdmin =
      user.isSuperAdmin ||
      user.roles.includes('HR_ADMIN') ||
      user.roles.includes('HR_MANAGER');

    const targetEmployeeId = isHrOrAdmin ? params.employeeId : user.employeeId;
    const targetCompanyId =
      params.companyId ||
      user.activeCompanyId ||
      (user.isSuperAdmin ? undefined : user.companyId);

    const page = params.page ? Number(params.page) : 1;
    const limit = params.limit ? Number(params.limit) : 31;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (targetCompanyId) {
      where.companyId = targetCompanyId;
    }
    if (targetEmployeeId) {
      where.employeeId = targetEmployeeId;
    }

    if (params.startDate && params.endDate) {
      where.date = {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate),
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.attendanceRecord.count({ where }),
      this.prisma.attendanceRecord.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              department: { select: { name: true } },
              officeLocation: { select: { name: true, radiusMeters: true } },
            },
          },
          events: {
            orderBy: { timestamp: 'desc' },
          },
        },
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
    ]);

    return {
      items: items.map((rec) => ({
        ...rec,
        events: rec.events.map((e) => {
          const hasPhoto = e.remarks?.includes('[FacePhoto: ');
          const photoUrl = hasPhoto ? e.remarks!.split('[FacePhoto: ')[1].split(']')[0] : null;
          return {
            ...e,
            latitude: Number(e.latitude),
            longitude: Number(e.longitude),
            distanceMeters: Number(e.distanceMeters),
            photoUrl,
          };
        }),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Request Attendance Correction
   */
  async requestCorrection(dto: RequestCorrectionDto, user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee profile required');
    }

    const reqDate = new Date(dto.requestDate);
    reqDate.setHours(0, 0, 0, 0);

    const record = await this.prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId: user.employeeId,
          date: reqDate,
        },
      },
    });

    return this.prisma.attendanceCorrectionRequest.create({
      data: {
        employeeId: user.employeeId,
        companyId: user.companyId!,
        attendanceRecordId: record?.id || null,
        requestDate: reqDate,
        requestedCheckIn: dto.requestedCheckIn ? new Date(dto.requestedCheckIn) : null,
        requestedCheckOut: dto.requestedCheckOut ? new Date(dto.requestedCheckOut) : null,
        reason: dto.reason,
        status: CorrectionStatus.PENDING,
      },
    });
  }

  /**
   * Review Attendance Correction (HR)
   */
  async reviewCorrection(id: string, dto: ReviewCorrectionDto, user: AuthenticatedUser) {
    const correction = await this.prisma.attendanceCorrectionRequest.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!correction) {
      throw new NotFoundException('Correction request not found');
    }

    if (!user.isSuperAdmin && user.companyId !== correction.companyId) {
      throw new ForbiddenException('Cannot review correction for another company');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedCorrection = await tx.attendanceCorrectionRequest.update({
        where: { id },
        data: {
          status: dto.status,
          reviewedById: user.id,
          reviewRemarks: dto.reviewRemarks,
          reviewedAt: new Date(),
        },
      });

      // If approved, update or create AttendanceRecord
      if (dto.status === CorrectionStatus.APPROVED) {
        let rec = await tx.attendanceRecord.findUnique({
          where: {
            employeeId_date: {
              employeeId: correction.employeeId,
              date: correction.requestDate,
            },
          },
        });

        if (!rec) {
          rec = await tx.attendanceRecord.create({
            data: {
              employeeId: correction.employeeId,
              companyId: correction.companyId,
              date: correction.requestDate,
              status: AttendanceStatus.PRESENT,
              firstCheckIn: correction.requestedCheckIn,
              lastCheckOut: correction.requestedCheckOut,
              isManualEntry: true,
              manualEntryBy: user.email,
              manualEntryReason: `Approved correction: ${correction.reason}`,
            },
          });
        } else {
          await tx.attendanceRecord.update({
            where: { id: rec.id },
            data: {
              status: AttendanceStatus.PRESENT,
              firstCheckIn: correction.requestedCheckIn || rec.firstCheckIn,
              lastCheckOut: correction.requestedCheckOut || rec.lastCheckOut,
              isManualEntry: true,
              manualEntryBy: user.email,
              manualEntryReason: `Approved correction: ${correction.reason}`,
            },
          });
        }
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          companyId: correction.companyId,
          actorId: user.id,
          actorEmail: user.email,
          action: `ATTENDANCE_CORRECTION_${dto.status}`,
          entityName: 'AttendanceCorrectionRequest',
          entityId: id,
          afterJson: JSON.stringify(dto),
          reason: dto.reviewRemarks || 'Attendance correction review',
        },
      });

      return updatedCorrection;
    });
  }

  /**
   * Manual Attendance Override (HR Admin)
   */
  async manualOverride(dto: ManualAttendanceOverrideDto, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!user.isSuperAdmin && user.companyId !== employee.companyId) {
      throw new ForbiddenException('Cannot modify attendance of another company');
    }

    const targetDate = new Date(dto.date);
    targetDate.setHours(0, 0, 0, 0);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: targetDate,
          },
        },
      });

      const updated = await tx.attendanceRecord.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: targetDate,
          },
        },
        update: {
          status: dto.status,
          firstCheckIn: dto.firstCheckIn ? new Date(dto.firstCheckIn) : existing?.firstCheckIn,
          lastCheckOut: dto.lastCheckOut ? new Date(dto.lastCheckOut) : existing?.lastCheckOut,
          isManualEntry: true,
          manualEntryBy: user.email,
          manualEntryReason: dto.reason,
        },
        create: {
          employeeId: employee.id,
          companyId: employee.companyId,
          date: targetDate,
          status: dto.status,
          firstCheckIn: dto.firstCheckIn ? new Date(dto.firstCheckIn) : null,
          lastCheckOut: dto.lastCheckOut ? new Date(dto.lastCheckOut) : null,
          isManualEntry: true,
          manualEntryBy: user.email,
          manualEntryReason: dto.reason,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: employee.companyId,
          actorId: user.id,
          actorEmail: user.email,
          action: 'MANUAL_ATTENDANCE_OVERRIDE',
          entityName: 'AttendanceRecord',
          entityId: updated.id,
          beforeJson: existing ? JSON.stringify(existing) : null,
          afterJson: JSON.stringify(updated),
          reason: dto.reason,
        },
      });

      return updated;
    });
  }

  /**
   * Pending Correction Requests (HR)
   */
  async getMyCorrections(user: AuthenticatedUser) {
    if (!user.employeeId) return [];
    const corrections = await this.prisma.attendanceCorrectionRequest.findMany({
      where: { employeeId: user.employeeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return corrections;
  }

  async getPendingCorrections(user: AuthenticatedUser, companyIdQuery?: string) {
    const targetCompanyId = companyIdQuery || user.activeCompanyId || (user.isSuperAdmin ? undefined : user.companyId);

    const where: any = { status: CorrectionStatus.PENDING };
    if (targetCompanyId) {
      where.companyId = targetCompanyId;
    }

    return this.prisma.attendanceCorrectionRequest.findMany({
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInOutReport(reportDate: string, user: AuthenticatedUser, companyIdQuery?: string) {
    const targetDate = reportDate ? new Date(reportDate) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const companyId = companyIdQuery || user.activeCompanyId || (user.isSuperAdmin ? undefined : user.companyId);

    const employees = await this.prisma.employee.findMany({
      where: companyId ? { companyId, employmentStatus: { in: ['FULL_TIME', 'PROBATION', 'CONTRACT'] } } : { employmentStatus: { in: ['FULL_TIME', 'PROBATION', 'CONTRACT'] } },
      include: {
        department: true,
        attendanceRecords: {
          where: {
            date: {
              gte: targetDate,
              lt: nextDate,
            },
          },
          include: {
            events: {
              orderBy: { timestamp: 'asc' },
              take: 2,
            },
          },
        },
      },
      orderBy: { employeeCode: 'asc' },
    });

    return employees.map((emp) => {
      const rec = emp.attendanceRecords[0];
      const checkin = rec?.firstCheckIn ? new Date(rec.firstCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
      const checkout = rec?.lastCheckOut ? new Date(rec.lastCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
      const hours = rec?.totalWorkMinutes ? Math.round((rec.totalWorkMinutes / 60) * 10) / 10 : 0;
      const isField = emp.workLocationType === 'OFF_SITE';

      let status = 'absent';
      if (rec) {
        if (rec.status === AttendanceStatus.PRESENT) status = 'present';
        else if (rec.status === AttendanceStatus.HALF_DAY) status = 'half_day';
        else if (rec.status === AttendanceStatus.ON_LEAVE) status = 'leave';
      }

      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        employee_code: emp.employeeCode,
        department: emp.department?.name || null,
        source: isField ? 'gps' : 'biometric',
        checkin,
        checkout,
        total_hours: hours,
        location: isField ? 'Field / WFH' : 'In Office',
        status,
        is_late: rec?.isLate || false,
      };
    });
  }

  async getDailyReport(reportDate: string, user: AuthenticatedUser, companyIdQuery?: string) {
    const targetDate = reportDate ? new Date(reportDate) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const companyId = companyIdQuery || user.activeCompanyId || (user.isSuperAdmin ? undefined : user.companyId);

    const employees = await this.prisma.employee.findMany({
      where: companyId ? { companyId, employmentStatus: { in: ['FULL_TIME', 'PROBATION', 'CONTRACT'] } } : { employmentStatus: { in: ['FULL_TIME', 'PROBATION', 'CONTRACT'] } },
      include: {
        department: true,
        designation: true,
        attendanceRecords: {
          where: {
            date: {
              gte: targetDate,
              lt: nextDate,
            },
          },
        },
      },
      orderBy: { employeeCode: 'asc' },
    });

    const dateStr = reportDate || targetDate.toISOString().split('T')[0];

    return employees.map((emp) => {
      const rec = emp.attendanceRecords[0];
      let status = 'absent';
      if (rec) {
        if (rec.status === AttendanceStatus.PRESENT) status = rec.isLate ? 'late' : 'present';
        else if (rec.status === AttendanceStatus.HALF_DAY) status = 'half_day';
        else if (rec.status === AttendanceStatus.ON_LEAVE) status = 'leave';
      }

      const hours = rec?.totalWorkMinutes ? Math.round((rec.totalWorkMinutes / 60) * 10) / 10 : 0;
      const isLate = rec?.isLate || (rec?.lateMinutes ? rec.lateMinutes > 0 : false);

      let notes = 'Absent';
      if (status === 'present') notes = isLate ? `Late by ${rec?.lateMinutes || 0} mins` : 'On Time';
      else if (status === 'late') notes = `Late by ${rec?.lateMinutes || 0} mins`;
      else if (status === 'half_day') notes = 'Half Day';
      else if (status === 'leave') notes = 'Approved Leave';

      return {
        date: dateStr,
        employee_id: emp.id,
        employee_name: `${emp.firstName} ${emp.lastName}`.trim(),
        employee_code: emp.employeeCode,
        department_name: emp.department?.name || 'General',
        designation_name: emp.designation?.title || 'Specialist',
        joining_date: emp.joiningDate ? emp.joiningDate.toISOString().split('T')[0] : '',
        status,
        first_in: rec?.firstCheckIn || null,
        last_out: rec?.lastCheckOut || null,
        total_hours: hours,
        is_late: isLate ? 'Yes' : 'No',
        late_minutes: rec?.lateMinutes || 0,
        early_exit: false,
        early_exit_minutes: 0,
        notes,
      };
    });
  }

  async getMonthlyReport(month: number, year: number, user: AuthenticatedUser, companyIdQuery?: string) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const totalWorkingDays = 22; // Typical standard working days

    const companyId = companyIdQuery || user.activeCompanyId || (user.isSuperAdmin ? undefined : user.companyId);

    const employees = await this.prisma.employee.findMany({
      where: companyId ? { companyId, employmentStatus: { in: ['FULL_TIME', 'PROBATION', 'CONTRACT'] } } : { employmentStatus: { in: ['FULL_TIME', 'PROBATION', 'CONTRACT'] } },
      include: {
        department: true,
        designation: true,
        attendanceRecords: {
          where: {
            date: {
              gte: start,
              lt: end,
            },
          },
        },
      },
      orderBy: { employeeCode: 'asc' },
    });

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const periodLabel = `${monthNames[month - 1] || 'Month'} ${year}`;

    return employees.map((emp) => {
      const recs = emp.attendanceRecords;
      const presentDays = recs.filter((r) => r.status === AttendanceStatus.PRESENT).length;
      const halfDays = recs.filter((r) => r.status === AttendanceStatus.HALF_DAY).length;
      const lateDays = recs.filter((r) => r.isLate).length;
      const absentDays = Math.max(0, totalWorkingDays - (presentDays + halfDays * 0.5));
      const percentage = Math.round(((presentDays + halfDays * 0.5) / totalWorkingDays) * 100);

      let remarks = 'Excellent Attendance';
      if (percentage < 75) remarks = 'Critical / Low Attendance';
      else if (percentage < 90) remarks = 'Average Attendance';

      return {
        period: periodLabel,
        employee_id: emp.id,
        employee_name: `${emp.firstName} ${emp.lastName}`.trim(),
        employee_code: emp.employeeCode,
        department_name: emp.department?.name || 'General',
        designation_name: emp.designation?.title || 'Specialist',
        joining_date: emp.joiningDate ? emp.joiningDate.toISOString().split('T')[0] : '',
        total_working_days: totalWorkingDays,
        present_days: presentDays,
        absent_days: absentDays,
        late_days: lateDays,
        half_days: halfDays,
        attendance_percentage: percentage,
        remarks,
      };
    });
  }

  /**
   * Automated Punch-Out Fallback after 17:30 IST
   * If an office employee verified inside the geofence forgets to punch out,
   * automatically record punch-out at 17:30 (Shift End).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoCheckOutAfter1730() {
    const now = new Date();
    const istTimeStr = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const [hours, minutes] = istTimeStr.split(':').map(Number);
    const totalMinutes = (hours || 0) * 60 + (minutes || 0);
    const shiftEndMinutes = 17 * 60 + 30; // 17:30 IST

    // Run only after 17:30 IST
    if (totalMinutes < shiftEndMinutes) {
      return;
    }

    const istDateString = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const today = new Date(`${istDateString}T00:00:00.000Z`);

    try {
      const openOfficeRecords = await this.prisma.attendanceRecord.findMany({
        where: {
          date: today,
          firstCheckIn: { not: null },
          lastCheckOut: null,
          employee: {
            workLocationType: 'ON_SITE',
          },
        },
        include: {
          employee: {
            include: {
              officeLocation: true,
            },
          },
          events: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      for (const record of openOfficeRecords) {
        const lastEvent = record.events?.[0];
        // If employee was verified inside geofence on their check-in / last event
        const wasInGeofence = lastEvent ? lastEvent.isWithinGeofence : true;

        if (wasInGeofence && record.firstCheckIn) {
          const shiftEndTime = new Date(`${istDateString}T17:30:00.000+05:30`);
          const checkOutTime = now > shiftEndTime ? shiftEndTime : now;
          const diffMs = Math.max(0, checkOutTime.getTime() - record.firstCheckIn.getTime());
          const totalWorkMinutes = Math.floor(diffMs / (1000 * 60));

          await this.prisma.attendanceRecord.update({
            where: { id: record.id },
            data: {
              lastCheckOut: checkOutTime,
              totalWorkMinutes,
              remarks: `Auto Punch-Out at 17:30 (Shift End: verified inside geofence)`,
            },
          });

          await this.prisma.attendanceEvent.create({
            data: {
              attendanceRecordId: record.id,
              employeeId: record.employeeId,
              officeLocationId: record.employee.officeLocationId,
              eventType: AttendanceEventType.CHECK_OUT,
              timestamp: checkOutTime,
              latitude: lastEvent?.latitude || record.employee.officeLocation?.latitude || 0,
              longitude: lastEvent?.longitude || record.employee.officeLocation?.longitude || 0,
              accuracyMeters: lastEvent?.accuracyMeters || 10,
              isWithinGeofence: true,
              distanceMeters: lastEvent?.distanceMeters || 0,
              validationStatus: GeofenceValidationStatus.VALID,
              remarks: 'Auto-Checkout after 17:30 (Shift End fallback)',
            },
          });
        }
      }
    } catch (_) {}
  }
}
