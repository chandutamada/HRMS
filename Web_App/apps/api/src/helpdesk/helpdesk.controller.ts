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
import { HelpdeskService } from './helpdesk.service';
import {
  CreateTicketDto,
  AddTicketMessageDto,
  UpdateTicketStatusDto,
} from './dto/helpdesk.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Helpdesk & Support')
@Controller('helpdesk')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class HelpdeskController {
  constructor(private readonly helpdeskService: HelpdeskService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Create a new support ticket' })
  createTicket(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.helpdeskService.createTicket(dto, user);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List tickets (Employee views self, HR views company)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.helpdeskService.findAll(user, companyId);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get ticket details and conversation thread' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.helpdeskService.findOne(id, user);
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Post a response message to ticket' })
  addMessage(
    @Param('id') id: string,
    @Body() dto: AddTicketMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.helpdeskService.addMessage(id, dto, user);
  }

  @Put('tickets/:id/status')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Update ticket status and resolution notes (HR)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.helpdeskService.updateStatus(id, dto, user);
  }
}
