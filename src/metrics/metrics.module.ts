import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';

@Module({
  imports: [ConfigModule],
  providers: [CloudWatchMetricsService],
  exports: [CloudWatchMetricsService],
})
export class MetricsModule {}
