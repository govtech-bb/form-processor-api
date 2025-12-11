import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentIntegrationService } from './payment-integration.service';
import { PaymentWebhookService } from './payment-webhook.service';
import {
  Payment,
  PaymentTransaction,
  FormSubmissionPayment,
} from '../database/entities';
import { EZPayService, PaymentsController } from './ezpay';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      PaymentTransaction,
      FormSubmissionPayment,
    ]),
  ],
  providers: [PaymentIntegrationService, PaymentWebhookService, EZPayService],
  controllers: [PaymentsController],
  exports: [PaymentIntegrationService, PaymentWebhookService],
})
export class PaymentsModule {}
