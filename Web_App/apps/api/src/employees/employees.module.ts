import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { ShiftsController } from './shifts.controller';

@Module({
  controllers: [EmployeesController, ShiftsController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
