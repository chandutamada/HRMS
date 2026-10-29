import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    user: AuthenticatedUser,
    params: {
      companyId?: string;
      action?: string;
      entityName?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const targetCompanyId = user.isSuperAdmin
      ? params.companyId || user.companyId
      : user.companyId;

    const page = params.page ? Number(params.page) : 1;
    const limit = params.limit ? Number(params.limit) : 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (targetCompanyId) {
      where.companyId = targetCompanyId;
    }
    if (params.action) {
      where.action = params.action;
    }
    if (params.entityName) {
      where.entityName = params.entityName;
    }

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          company: { select: { code: true, name: true } },
          actor: { select: { email: true, employeeCode: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
