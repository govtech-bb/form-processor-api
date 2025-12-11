import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { EZPayService } from './ezpay.service';
import { PaymentsController } from '../payment.controller';
import { EZPayExceptionFilter } from './exceptions';
import { PaymentsModule } from '../payments.module';

@Module({
  imports: [ConfigModule, PaymentsModule],
  providers: [
    EZPayService,
    {
      provide: APP_FILTER,
      useClass: EZPayExceptionFilter,
    },
  ],
  controllers: [PaymentsController],
  exports: [EZPayService],
})
export class EZPayModule {}
