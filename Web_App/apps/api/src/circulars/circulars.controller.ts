import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CircularsService } from './circulars.service';
import { CreateCircularDto } from './dto/circular.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Circulars & Announcements')
@Controller('circulars')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CircularsController {
  constructor(private readonly circularsService: CircularsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({
    summary:
      'Publish company circular (Select target companies via checkboxes: SUPERBEE, GTIDS, GTIB)',
  })
  create(@Body() dto: CreateCircularDto, @CurrentUser() user: AuthenticatedUser) {
    return this.circularsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List applicable circulars for user company' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.circularsService.findAll(user);
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge circular reading by employee' })
  acknowledge(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.circularsService.acknowledge(id, user);
  }

  @Get(':id/stats')
  @Roles('SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER')
  @ApiOperation({ summary: 'Get circular acknowledgement statistics' })
  getStats(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.circularsService.getStats(id, user);
  }
}
