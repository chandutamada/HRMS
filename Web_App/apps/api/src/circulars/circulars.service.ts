import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCircularDto } from './dto/circular.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CircularStatus, NotificationType } from '@prisma/client';

@Injectable()
export class CircularsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCircularDto, user: AuthenticatedUser) {
    if (!dto.targetCompanyCodes || dto.targetCompanyCodes.length === 0) {
      throw new BadRequestException('At least one target company must be selected');
    }

    // Resolve companies
    const companies = await this.prisma.company.findMany({
      where: { code: { in: dto.targetCompanyCodes } },
    });

    if (companies.length === 0) {
      throw new BadRequestException('Invalid target companies specified');
    }

    // Non-superadmin can only target their own company
    if (!user.isSuperAdmin && !user.roles.includes('SUPER_ADMIN')) {
      const unauthorized = companies.some((c) => c.id !== user.companyId);
      if (unauthorized) {
        throw new ForbiddenException('You can only target circulars to your assigned company');
      }
    }

    const circular = await this.prisma.$transaction(async (tx) => {
      const created = await tx.circular.create({
        data: {
          title: dto.title,
          content: dto.content,
          status: dto.status || CircularStatus.PUBLISHED,
          requiresAcknowledgement: dto.requiresAcknowledgement !== undefined ? dto.requiresAcknowledgement : false,
          publishedAt: dto.status === CircularStatus.PUBLISHED ? new Date() : null,
          createdById: user.id,
        },
      });

      // Target companies
      for (const comp of companies) {
        await tx.circularTargetCompany.create({
          data: {
            circularId: created.id,
            companyId: comp.id,
          },
        });
      }

      // Create in-app notifications for employees of targeted companies
      if (dto.status === CircularStatus.PUBLISHED) {
        const targetEmployees = await tx.employee.findMany({
          where: { companyId: { in: companies.map((c) => c.id) } },
          select: { userId: true, companyId: true },
        });

        for (const emp of targetEmployees) {
          await tx.notification.create({
            data: {
              userId: emp.userId,
              companyId: emp.companyId,
              type: NotificationType.CIRCULAR,
              referenceId: created.id,
              title: `New Circular: ${dto.title}`,
              message: dto.content.slice(0, 150) + (dto.content.length > 150 ? '...' : ''),
            },
          });
        }
      }

      return created;
    });

    return circular;
  }

  async findAll(user: AuthenticatedUser) {
    let whereClause: any = { status: CircularStatus.PUBLISHED };

    if (!user.isSuperAdmin && user.companyId) {
      whereClause.targetCompanies = {
        some: {
          companyId: user.companyId,
        },
      };
    }

    const circulars = await this.prisma.circular.findMany({
      where: whereClause,
      include: {
        targetCompanies: {
          include: {
            company: {
              select: { id: true, code: true, name: true },
            },
          },
        },
        acknowledgements: user.employeeId
          ? {
              where: { employeeId: user.employeeId },
              take: 1,
            }
          : false,
        _count: {
          select: { acknowledgements: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return circulars.map((c) => ({
      ...c,
      isAcknowledged: user.employeeId ? (c.acknowledgements?.length || 0) > 0 : false,
      acknowledgedAt: user.employeeId && c.acknowledgements?.[0]?.acknowledgedAt || null,
      targetCompanyNames: c.targetCompanies.map((tc) => tc.company.name),
      targetCompanyCodes: c.targetCompanies.map((tc) => tc.company.code),
    }));
  }

  async acknowledge(id: string, user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee profile required to acknowledge circular');
    }

    const circular = await this.prisma.circular.findUnique({
      where: { id },
      include: { targetCompanies: true },
    });

    if (!circular) {
      throw new NotFoundException('Circular not found');
    }

    // Verify company eligibility
    const isTargeted = circular.targetCompanies.some((tc) => tc.companyId === user.companyId);
    if (!isTargeted && !user.isSuperAdmin) {
      throw new ForbiddenException('Circular not applicable to your company');
    }

    return this.prisma.circularAcknowledgement.upsert({
      where: {
        circularId_employeeId: {
          circularId: id,
          employeeId: user.employeeId,
        },
      },
      update: { acknowledgedAt: new Date() },
      create: {
        circularId: id,
        employeeId: user.employeeId,
        acknowledgedAt: new Date(),
      },
    });
  }

  async getStats(id: string, user: AuthenticatedUser) {
    const circular = await this.prisma.circular.findUnique({
      where: { id },
      include: {
        targetCompanies: { include: { company: true } },
        acknowledgements: {
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
        },
      },
    });

    if (!circular) {
      throw new NotFoundException('Circular not found');
    }

    const targetCompanyIds = circular.targetCompanies.map((t) => t.companyId);
    const totalTargetEmployees = await this.prisma.employee.count({
      where: { companyId: { in: targetCompanyIds } },
    });

    return {
      circularId: id,
      title: circular.title,
      totalTargetEmployees,
      totalAcknowledged: circular.acknowledgements.length,
      acknowledgementRate:
        totalTargetEmployees > 0
          ? `${Math.round((circular.acknowledgements.length / totalTargetEmployees) * 100)}%`
          : '0%',
      acknowledgements: circular.acknowledgements,
    };
  }
}
