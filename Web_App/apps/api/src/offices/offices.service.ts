import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOfficeDto,
  UpdateOfficeGeofenceDto,
  TestGeofenceDistanceDto,
} from './dto/office.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  calculateHaversineDistance,
  isWithinGeofenceRadius,
} from '../common/utils/geofence.util';

@Injectable()
export class OfficesService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser, companyIdQuery?: string) {
    const targetCompanyId =
      companyIdQuery ||
      user.activeCompanyId ||
      (user.isSuperAdmin ? undefined : user.companyId);

    const whereClause: any = {};
    if (targetCompanyId) {
      whereClause.companyId = targetCompanyId;
    }

    const offices = await this.prisma.officeLocation.findMany({
      where: whereClause,
      include: {
        company: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return offices.map((o) => ({
      ...o,
      latitude: Number(o.latitude),
      longitude: Number(o.longitude),
    }));
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const office = await this.prisma.officeLocation.findUnique({
      where: { id },
      include: {
        company: true,
        geofenceAudits: {
          include: {
            changedBy: {
              select: {
                id: true,
                email: true,
                employeeCode: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    if (!office) {
      throw new NotFoundException(`Office location with ID ${id} not found`);
    }

    if (!user.isSuperAdmin && user.companyId !== office.companyId) {
      throw new ForbiddenException('Access denied to other company office data');
    }

    return {
      ...office,
      latitude: Number(office.latitude),
      longitude: Number(office.longitude),
      geofenceAudits: office.geofenceAudits.map((a) => ({
        ...a,
        oldLatitude: Number(a.oldLatitude),
        oldLongitude: Number(a.oldLongitude),
        newLatitude: Number(a.newLatitude),
        newLongitude: Number(a.newLongitude),
      })),
    };
  }

  async create(dto: CreateOfficeDto, user: AuthenticatedUser) {
    const targetCompanyId = user.isSuperAdmin
      ? dto.companyId || user.companyId
      : user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestException('Company ID is required to create an office');
    }

    const office = await this.prisma.officeLocation.create({
      data: {
        companyId: targetCompanyId,
        name: dto.name,
        code: dto.code,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radiusMeters: dto.radiusMeters || 50,
        timezone: dto.timezone || 'Asia/Kolkata',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        attendanceValidationEnabled:
          dto.attendanceValidationEnabled !== undefined
            ? dto.attendanceValidationEnabled
            : true,
      },
      include: { company: true },
    });

    return {
      ...office,
      latitude: Number(office.latitude),
      longitude: Number(office.longitude),
    };
  }

  async updateGeofence(id: string, dto: UpdateOfficeGeofenceDto, user: AuthenticatedUser) {
    const office = await this.prisma.officeLocation.findUnique({ where: { id } });
    if (!office) {
      throw new NotFoundException('Office location not found');
    }

    if (!user.isSuperAdmin && user.companyId !== office.companyId) {
      throw new ForbiddenException('You cannot modify another company office geofence');
    }

    const oldRadius = office.radiusMeters;
    const oldLat = office.latitude;
    const oldLon = office.longitude;

    const newRadius = dto.radiusMeters !== undefined ? dto.radiusMeters : oldRadius;
    const newLat = dto.latitude !== undefined ? dto.latitude : oldLat;
    const newLon = dto.longitude !== undefined ? dto.longitude : oldLon;

    // Use transaction to update office and save audit record
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedOffice = await tx.officeLocation.update({
        where: { id },
        data: {
          name: dto.name || office.name,
          address: dto.address || office.address,
          latitude: newLat,
          longitude: newLon,
          radiusMeters: newRadius,
          isActive: dto.isActive !== undefined ? dto.isActive : office.isActive,
          attendanceValidationEnabled:
            dto.attendanceValidationEnabled !== undefined
              ? dto.attendanceValidationEnabled
              : office.attendanceValidationEnabled,
        },
      });

      // Geofence Audit Log
      await tx.geofenceAuditLog.create({
        data: {
          officeLocationId: id,
          changedById: user.id,
          oldRadiusMeters: oldRadius,
          newRadiusMeters: newRadius,
          oldLatitude: oldLat,
          oldLongitude: oldLon,
          newLatitude: newLat,
          newLongitude: newLon,
          reason: dto.reason,
        },
      });

      // System Audit Log
      await tx.auditLog.create({
        data: {
          companyId: office.companyId,
          actorId: user.id,
          actorEmail: user.email,
          action: 'GEOFENCE_UPDATED',
          entityName: 'OfficeLocation',
          entityId: id,
          beforeJson: JSON.stringify({
            radius: oldRadius,
            latitude: Number(oldLat),
            longitude: Number(oldLon),
          }),
          afterJson: JSON.stringify({
            radius: newRadius,
            latitude: Number(newLat),
            longitude: Number(newLon),
          }),
          reason: dto.reason,
        },
      });

      return updatedOffice;
    });

    return {
      ...updated,
      latitude: Number(updated.latitude),
      longitude: Number(updated.longitude),
    };
  }

  async remove(id: string, user: AuthenticatedUser) {
    const office = await this.prisma.officeLocation.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });

    if (!office) {
      throw new NotFoundException('Office location not found');
    }

    if (!user.isSuperAdmin && office.companyId !== user.companyId) {
      throw new ForbiddenException('Access denied to delete this office location');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Safely unlink assigned employees
      await tx.employee.updateMany({
        where: { officeLocationId: id },
        data: { officeLocationId: null },
      });

      // 2. Safely unlink attendance events
      await tx.attendanceEvent.updateMany({
        where: { officeLocationId: id },
        data: { officeLocationId: null },
      });

      // 3. Clean up any geofence audit logs
      await tx.geofenceAuditLog.deleteMany({
        where: { officeLocationId: id },
      });

      // 4. Delete the office location
      await tx.officeLocation.delete({
        where: { id },
      });

      // 5. Create System Audit Log
      await tx.auditLog.create({
        data: {
          companyId: office.companyId,
          actorId: user.id,
          actorEmail: user.email,
          action: 'OFFICE_LOCATION_DELETED',
          entityName: 'OfficeLocation',
          entityId: id,
          beforeJson: JSON.stringify({
            name: office.name,
            code: office.code,
            address: office.address,
            latitude: Number(office.latitude),
            longitude: Number(office.longitude),
            radiusMeters: office.radiusMeters,
            assignedEmployeesCount: office._count.employees,
          }),
          reason: 'Office location removed by HR Administrator',
        },
      });

      return {
        success: true,
        message: `Office "${office.name}" (${office.code}) has been successfully deleted.`,
        deletedOfficeId: id,
      };
    });
  }

  async testDistance(dto: TestGeofenceDistanceDto) {
    const office = await this.prisma.officeLocation.findUnique({
      where: { id: dto.officeId },
    });

    if (!office) {
      throw new NotFoundException('Office location not found');
    }

    const officeLat = Number(office.latitude);
    const officeLon = Number(office.longitude);

    const check = isWithinGeofenceRadius(
      dto.latitude,
      dto.longitude,
      officeLat,
      officeLon,
      office.radiusMeters,
    );

    return {
      officeName: office.name,
      officeCoordinates: { latitude: officeLat, longitude: officeLon },
      testCoordinates: { latitude: dto.latitude, longitude: dto.longitude },
      distanceMeters: check.distanceMeters,
      geofenceRadiusMeters: office.radiusMeters,
      isWithinGeofence: check.isWithin,
      status: check.isWithin ? 'VALID' : 'OUTSIDE_GEOFENCE',
    };
  }

  async assignEmployees(officeId: string, employeeIds: string[], user: AuthenticatedUser) {
    const office = await this.prisma.officeLocation.findUnique({
      where: { id: officeId },
    });
    if (!office) {
      throw new NotFoundException('Office location not found');
    }

    if (employeeIds && employeeIds.length > 0) {
      await this.prisma.employee.updateMany({
        where: { id: { in: employeeIds } },
        data: { officeLocationId: officeId },
      });
    } else if (user.employeeId) {
      await this.prisma.employee.update({
        where: { id: user.employeeId },
        data: { officeLocationId: officeId },
      });
    }

    return {
      success: true,
      message: `Assigned office "${office.name}" successfully.`,
      officeId,
    };
  }

  async assignAllEmployees(officeId: string, user: AuthenticatedUser) {
    const office = await this.prisma.officeLocation.findUnique({
      where: { id: officeId },
    });
    if (!office) {
      throw new NotFoundException('Office location not found');
    }

    const whereClause: any = {};
    if (office.companyId) {
      whereClause.companyId = office.companyId;
    }

    await this.prisma.employee.updateMany({
      where: whereClause,
      data: { officeLocationId: officeId },
    });

    return {
      success: true,
      message: `Assigned all employees to "${office.name}".`,
      officeId,
    };
  }
}
