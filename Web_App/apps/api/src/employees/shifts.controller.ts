import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Shifts')
@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ShiftsController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'List all company shifts' })
  getShifts(@CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.getShifts(user);
  }

  @Post()
  @ApiOperation({ summary: 'Create new shift timing' })
  createShift(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.createShift(dto, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update shift timing' })
  updateShift(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.updateShift(id, dto, user);
  }
}
