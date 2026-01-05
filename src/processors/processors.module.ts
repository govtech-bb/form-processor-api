import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessorPipelineService } from './processor-pipeline.service';
import { EmailModule } from '../email/email.module';
import { PaymentsModule } from '../payments/payments.module';
import { GoogleSheetsModule } from '../google-sheets/google-sheets.module';
import { Payment, FormSubmissionPayment } from '../database/entities';
import { EmailProcessor } from './implementations/email.processor';
import { PaymentProcessor } from './implementations/payment.processor';
import { GoogleSheetsProcessor } from './implementations/google-sheets.processor';
import { EZPayService, DepartmentMappingService } from '../payments';

@Module({
  imports: [
    EmailModule,
    PaymentsModule,
    GoogleSheetsModule,
    TypeOrmModule.forFeature([Payment, FormSubmissionPayment]),
  ],
  providers: [
    ProcessorPipelineService,
    EmailProcessor,
    PaymentProcessor,
    GoogleSheetsProcessor,
    EZPayService,
    DepartmentMappingService,
  ],
  exports: [ProcessorPipelineService],
})
export class ProcessorsModule {
  constructor(
    private readonly pipelineService: ProcessorPipelineService,
    private readonly emailProcessor: EmailProcessor,
    private readonly paymentProcessor: PaymentProcessor,
    private readonly googleSheetsProcessor: GoogleSheetsProcessor,
  ) {
    // Register all processors
    this.pipelineService.registerProcessor(this.emailProcessor);
    this.pipelineService.registerProcessor(this.paymentProcessor);
    this.pipelineService.registerProcessor(this.googleSheetsProcessor);
  }
}
