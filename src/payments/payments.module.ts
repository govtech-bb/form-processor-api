import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentIntegrationService } from './payment-integration.service';
import { PaymentWebhookService } from './payment-webhook.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { DepartmentMappingService } from './department-mapping.service';
import {
  Payment,
  PaymentTransaction,
  FormSubmissionPayment,
} from '../database/entities';
import { EZPayService, PaymentsController } from './ezpay';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      PaymentTransaction,
      FormSubmissionPayment,
    ]),
    ScheduleModule.forRoot(),
    EmailModule,
  ],
  providers: [
    PaymentIntegrationService,
    PaymentWebhookService,
    PaymentReconciliationService,
    EZPayService,
    DepartmentMappingService,
  ],
  controllers: [PaymentsController],
  exports: [
    PaymentIntegrationService,
    PaymentWebhookService,
    PaymentReconciliationService,
    DepartmentMappingService,
  ],
})
export class PaymentsModule {}
