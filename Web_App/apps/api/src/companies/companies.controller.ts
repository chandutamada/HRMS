import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Companies')
@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'List authorized companies for current user' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed company information' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.findOne(id, user);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create new company (Super Admin only)' })
  create(@Body() dto: CreateCompanyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.create(dto, user);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'HR_ADMIN')
  @ApiOperation({ summary: 'Update company details' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companiesService.update(id, dto, user);
  }
}
