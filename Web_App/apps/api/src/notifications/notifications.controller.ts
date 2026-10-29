import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  NotificationsService,
  CreateFeedDto,
  SaveThoughtDto,
} from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Notifications & Live Feed')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Fetch user notifications with unread count' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unreadOnly') unreadOnly?: boolean,
  ) {
    return this.notificationsService.findAll(user, unreadOnly);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get Live Feed announcements and alerts' })
  getFeed(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getFeed(user);
  }

  @Post('feed')
  @ApiOperation({ summary: 'Post a new company announcement or greeting' })
  postFeed(@Body() dto: CreateFeedDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.postFeed(dto, user);
  }

  @Get('birthdays')
  @ApiOperation({ summary: 'Get upcoming birthdays within next 30 days' })
  getBirthdays(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getBirthdays(user);
  }

  @Get('thought')
  @ApiOperation({ summary: 'Get Thought of the Day' })
  getThought(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getThought(user);
  }

  @Post('thought')
  @ApiOperation({ summary: 'Save Thought of the Day' })
  saveThought(@Body() dto: SaveThoughtDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.saveThought(dto, user);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Retrieve unread notification count' })
  getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadCount(user);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read (Patch)' })
  patchAsRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAsRead(id, user);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read (Put)' })
  markAsRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAsRead(id, user);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user);
  }
}
