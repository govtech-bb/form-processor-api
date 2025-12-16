import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentIntegrationService } from './payment-integration.service';
import { PaymentWebhookService } from './payment-webhook.service';
import { DepartmentMappingService } from './department-mapping.service';
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
  providers: [
    PaymentIntegrationService,
    PaymentWebhookService,
    EZPayService,
    DepartmentMappingService,
  ],
  controllers: [PaymentsController],
  exports: [
    PaymentIntegrationService,
    PaymentWebhookService,
    DepartmentMappingService,
  ],
})
export class PaymentsModule {}
