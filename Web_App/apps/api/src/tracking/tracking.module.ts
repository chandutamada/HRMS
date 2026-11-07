import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TrackingService } from './tracking.service';
import { TrackingGateway } from './tracking.gateway';
import {
  TrackingController,
  LiveLocationCompatController,
  SessionsCompatController,
} from './tracking.controller';
import { TrackingTraccarController } from './tracking-traccar.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN', '1h') as any) },
      }),
    }),
  ],
  controllers: [
    TrackingController,
    LiveLocationCompatController,
    SessionsCompatController,
    TrackingTraccarController,
  ],
  providers: [
    TrackingService,
    TrackingGateway,
  ],
  exports: [TrackingService, TrackingGateway],
})
export class TrackingModule {}
