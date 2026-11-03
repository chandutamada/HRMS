import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTicketDto,
  AddTicketMessageDto,
  UpdateTicketStatusDto,
} from './dto/helpdesk.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class HelpdeskService {
  constructor(private prisma: PrismaService) {}

  async createTicket(dto: CreateTicketDto, user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee profile required');
    }

    const ticketCount = await this.prisma.helpdeskTicket.count();
    const ticketNumber = `TICK-${new Date().getFullYear()}-${String(ticketCount + 1).padStart(4, '0')}`;

    return this.prisma.helpdeskTicket.create({
      data: {
        ticketNumber,
        employeeId: user.employeeId,
        companyId: user.companyId!,
        category: dto.category,
        priority: dto.priority || 'MEDIUM',
        subject: dto.subject,
        description: dto.description,
        status: TicketStatus.OPEN,
      },
    });
  }

  async findAll(user: AuthenticatedUser, companyIdQuery?: string) {
    const isHrOrAdmin =
      user.isSuperAdmin ||
      user.roles.includes('HR_ADMIN') ||
      user.roles.includes('HR_MANAGER');

    const where: any = {};

    if (!isHrOrAdmin) {
      // Regular employee: only their own tickets
      where.employeeId = user.employeeId;
    } else {
      const targetCompanyId =
        companyIdQuery ||
        user.activeCompanyId ||
        (user.isSuperAdmin ? undefined : user.companyId);
      if (targetCompanyId) {
        where.companyId = targetCompanyId;
      }
    }

    return this.prisma.helpdeskTicket.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const ticket = await this.prisma.helpdeskTicket.findUnique({
      where: { id },
      include: {
        employee: true,
        assignedTo: true,
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                employee: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const isHrOrAdmin =
      user.isSuperAdmin ||
      user.roles.includes('HR_ADMIN') ||
      user.roles.includes('HR_MANAGER');

    if (!isHrOrAdmin && ticket.employeeId !== user.employeeId) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    return ticket;
  }

  async addMessage(id: string, dto: AddTicketMessageDto, user: AuthenticatedUser) {
    const ticket = await this.prisma.helpdeskTicket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return this.prisma.helpdeskMessage.create({
      data: {
        ticketId: id,
        senderId: user.id,
        message: dto.message,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateTicketStatusDto, user: AuthenticatedUser) {
    const ticket = await this.prisma.helpdeskTicket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (!user.isSuperAdmin && user.companyId !== ticket.companyId) {
      throw new ForbiddenException('Cannot modify ticket from another company');
    }

    return this.prisma.helpdeskTicket.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionNotes: dto.resolutionNotes,
        resolvedAt: dto.status === TicketStatus.RESOLVED ? new Date() : null,
      },
    });
  }
}
