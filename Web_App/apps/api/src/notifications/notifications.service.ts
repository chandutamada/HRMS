import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotificationType } from '@prisma/client';

export interface CreateFeedDto {
  type: 'announcement' | 'info' | 'alert' | 'birthday' | 'system';
  title: string;
  message: string;
  expires_at?: string | null;
}

export interface SaveThoughtDto {
  date: string;
  thought: string;
  author?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private trackingGateway?: TrackingGateway,
  ) {}

  async findAll(user: AuthenticatedUser, unreadOnly?: boolean) {
    const where: any = { userId: user.id };
    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });

    return {
      unreadCount,
      notifications,
    };
  }

  async getFeed(user: AuthenticatedUser) {
    const whereConditions: any[] = [{ userId: user.id }];
    if (user.companyId) {
      whereConditions.push({ companyId: user.companyId, referenceId: { startsWith: 'feed:' } });
    } else {
      whereConditions.push({ referenceId: { startsWith: 'feed:' } });
    }

    const notifications = await this.prisma.notification.findMany({
      where: {
        OR: whereConditions,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Deduplicate feeds by title + message to avoid multi-user duplicate feed rows
    const seen = new Set<string>();
    const uniqueNotifs: typeof notifications = [];
    for (const n of notifications) {
      const key = `${n.title}|${n.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueNotifs.push(n);
      }
    }

    return uniqueNotifs.map((n) => {
      let feedType: string = 'system';
      let expiresAt: string | null = null;

      if (n.referenceId && n.referenceId.startsWith('feed:')) {
        const parts = n.referenceId.split(':');
        feedType = parts[1] || 'system';
        if (parts.length > 2) {
          expiresAt = parts.slice(2).join(':');
        }
      } else {
        switch (n.type) {
          case NotificationType.CIRCULAR:
            feedType = 'announcement';
            break;
          case NotificationType.ATTENDANCE:
            feedType = 'alert';
            break;
          case NotificationType.LEAVE:
          case NotificationType.PAYROLL:
            feedType = 'info';
            break;
          default:
            feedType = 'system';
        }
      }

      return {
        id: n.id,
        type: feedType,
        title: n.title,
        message: n.message,
        is_read: n.isRead,
        created_at: n.createdAt.toISOString(),
        expires_at: expiresAt,
      };
    });
  }

  async postFeed(dto: CreateFeedDto, user: AuthenticatedUser) {
    if (!dto.title || !dto.message) {
      throw new BadRequestException('Title and message are required');
    }

    const companyId = user.companyId;
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    const refId = `feed:${dto.type || 'announcement'}${dto.expires_at ? ':' + dto.expires_at : ''}`;
    const mappedType = dto.type === 'alert' ? NotificationType.SYSTEM : NotificationType.CIRCULAR;

    // Create notifications for all company users
    const createdNotifs = await this.prisma.$transaction(
      users.map((u) =>
        this.prisma.notification.create({
          data: {
            userId: u.id,
            companyId: companyId || null,
            title: dto.title,
            message: dto.message,
            type: mappedType,
            referenceId: refId,
          },
        }),
      ),
    );

    if (this.trackingGateway) {
      try {
        const payload = {
          id: createdNotifs[0]?.id || 'created',
          type: dto.type,
          title: dto.title,
          message: dto.message,
          created_at: new Date().toISOString(),
        };
        this.trackingGateway.server?.emit('feed:new_post', payload);
        this.trackingGateway.server?.emit('notification:new', payload);
      } catch (_) {}
    }

    return {
      success: true,
      count: createdNotifs.length,
      item: {
        id: createdNotifs[0]?.id || 'created',
        type: dto.type,
        title: dto.title,
        message: dto.message,
        created_at: new Date().toISOString(),
      },
    };
  }

  async getBirthdays(user: AuthenticatedUser) {
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: user.companyId || undefined,
        employmentStatus: { in: ['FULL_TIME', 'PROBATION', 'CONTRACT'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
      },
    });

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    const upcomingList: any[] = [];

    for (const emp of employees) {
      if (!emp.dateOfBirth) continue;
      const dob = new Date(emp.dateOfBirth);
      const bMonth = dob.getMonth();
      const bDay = dob.getDate();

      // Check if birthday in current year is coming up in next 30 days
      const bDateThisYear = new Date(today.getFullYear(), bMonth, bDay);
      if (bDateThisYear < new Date(today.getFullYear(), currentMonth, currentDay)) {
        bDateThisYear.setFullYear(today.getFullYear() + 1);
      }

      const diffTime = bDateThisYear.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 30) {
        upcomingList.push({
          employee_id: emp.id,
          employee_name: `${emp.firstName} ${emp.lastName}`.trim(),
          is_today: diffDays === 0,
          days_until: diffDays,
        });
      }
    }

    upcomingList.sort((a, b) => a.days_until - b.days_until);
    return upcomingList;
  }

  async getThought(user: AuthenticatedUser) {
    let setting = await this.prisma.applicationSetting.findFirst({
      where: {
        key: 'thought_of_the_day',
        companyId: user.companyId || null,
      },
    });

    if (!setting) {
      setting = await this.prisma.applicationSetting.findFirst({
        where: {
          key: 'thought_of_the_day',
        },
      });
    }

    if (!setting) return null;

    try {
      const parsed = JSON.parse(setting.value);
      return parsed;
    } catch {
      return { thought: setting.value, author: null, date: null };
    }
  }

  async saveThought(dto: SaveThoughtDto, user: AuthenticatedUser) {
    if (!dto.thought) {
      throw new BadRequestException('Thought text is required');
    }

    const companyId = user.companyId || null;
    const existing = await this.prisma.applicationSetting.findFirst({
      where: {
        key: 'thought_of_the_day',
        companyId,
      },
    });

    const val = JSON.stringify({
      thought: dto.thought,
      author: dto.author || null,
      date: dto.date || new Date().toISOString().split('T')[0],
      updatedBy: user.email,
    });

    if (existing) {
      await this.prisma.applicationSetting.update({
        where: { id: existing.id },
        data: { value: val },
      });
    } else {
      await this.prisma.applicationSetting.create({
        data: {
          key: 'thought_of_the_day',
          value: val,
          companyId,
          description: 'Daily inspirational thought of the day',
        },
      });
    }

    if (this.trackingGateway) {
      try {
        this.trackingGateway.server?.emit('thought:update', {
          thought: dto.thought,
          author: dto.author || null,
          date: dto.date || new Date().toISOString().split('T')[0],
        });
      } catch (_) {}
    }

    return {
      success: true,
      thought: dto.thought,
      author: dto.author,
      date: dto.date,
    };
  }

  async markAsRead(id: string, user: AuthenticatedUser) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== user.id) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(user: AuthenticatedUser) {
    return this.prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCount(user: AuthenticatedUser) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });
    return { unreadCount: count };
  }
}
