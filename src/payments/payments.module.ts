import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentWebhookService } from './payment-webhook.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { DepartmentMappingService } from './department-mapping.service';
import { AbandonedPaymentCleanupService } from './abandoned-payment-cleanup.service';
import {
  Payment,
  PaymentTransaction,
  FormSubmissionPayment,
} from '../database/entities';
import { EZPayService, PaymentsController } from './ezpay';
import { EmailModule } from '../email/email.module';
import { FormsModule } from '../forms/forms.module';
import { ProcessorsModule } from '../processors/processors.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      PaymentTransaction,
      FormSubmissionPayment,
    ]),
    ScheduleModule.forRoot(),
    EmailModule,
    forwardRef(() => FormsModule),
    forwardRef(() => ProcessorsModule),
  ],
  providers: [
    PaymentWebhookService,
    PaymentReconciliationService,
    EZPayService,
    DepartmentMappingService,
    AbandonedPaymentCleanupService,
  ],
  controllers: [PaymentsController],
  exports: [
    PaymentWebhookService,
    PaymentReconciliationService,
    DepartmentMappingService,
  ],
})
export class PaymentsModule {}
