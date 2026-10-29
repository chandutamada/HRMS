import { Module } from '@nestjs/common';
import { CircularsService } from './circulars.service';
import { CircularsController } from './circulars.controller';

@Module({
  controllers: [CircularsController],
  providers: [CircularsService],
  exports: [CircularsService],
})
export class CircularsModule {}
