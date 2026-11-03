import { Module } from '@nestjs/common';
import { CircularsService } from './circulars.service';
import { CircularsController } from './circulars.controller';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [TrackingModule],
  controllers: [CircularsController],
  providers: [CircularsService],
  exports: [CircularsService],
})
export class CircularsModule {}
