import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    if (user.isSuperAdmin || user.roles?.includes('SUPER_ADMIN')) {
      return this.prisma.company.findMany({
        include: {
          offices: true,
          _count: {
            select: {
              employees: true,
              departments: true,
            },
          },
        },
        orderBy: { code: 'asc' },
      });
    }

    // Non-superadmin: only assigned company
    if (!user.companyId) {
      throw new ForbiddenException('User is not assigned to any company');
    }

    return this.prisma.company.findMany({
      where: { id: user.companyId },
      include: {
        offices: true,
        _count: {
          select: {
            employees: true,
            departments: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    if (!user.isSuperAdmin && !user.roles?.includes('SUPER_ADMIN') && user.companyId !== id) {
      throw new ForbiddenException('Access denied to other company data');
    }

    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        offices: true,
        departments: {
          include: {
            designations: true,
          },
        },
        shifts: true,
        leaveTypes: true,
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    return company;
  }

  async create(dto: CreateCompanyDto, user: AuthenticatedUser) {
    if (!user.isSuperAdmin && !user.roles?.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Only Super Admin can create new companies');
    }

    const existing = await this.prisma.company.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(`Company with code ${dto.code} already exists`);
    }

    return this.prisma.company.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        legalName: dto.legalName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        status: dto.status || 'ACTIVE',
      },
    });
  }

  async update(id: string, dto: UpdateCompanyDto, user: AuthenticatedUser) {
    if (!user.isSuperAdmin && !user.roles?.includes('SUPER_ADMIN')) {
      if (user.companyId !== id || !user.roles?.includes('HR_ADMIN')) {
        throw new ForbiddenException('You do not have permission to modify this company');
      }
    }

    return this.prisma.company.update({
      where: { id },
      data: dto,
    });
  }
}
