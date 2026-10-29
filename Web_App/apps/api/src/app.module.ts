import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { OfficesModule } from './offices/offices.module';
import { EmployeesModule } from './employees/employees.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { CalendarModule } from './calendar/calendar.module';
import { PayrollModule } from './payroll/payroll.module';
import { CircularsModule } from './circulars/circulars.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HelpdeskModule } from './helpdesk/helpdesk.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    CompaniesModule,
    OfficesModule,
    EmployeesModule,
    AttendanceModule,
    LeaveModule,
    CalendarModule,
    PayrollModule,
    CircularsModule,
    NotificationsModule,
    HelpdeskModule,
    ReportsModule,
    AuditModule,
    TrackingModule,
  ],
})
export class AppModule {}
