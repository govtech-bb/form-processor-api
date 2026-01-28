import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  Payment,
  PaymentStatus,
  FormSubmissionPayment,
} from '../database/entities';

@Injectable()
export class AbandonedPaymentCleanupService {
  private readonly logger = new Logger(AbandonedPaymentCleanupService.name);
  private readonly abandonedPaymentTTLHours: number;

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(FormSubmissionPayment)
    private formSubmissionPaymentRepository: Repository<FormSubmissionPayment>,
    private configService: ConfigService,
  ) {
    // Default TTL: 72 hours (3 days) for abandoned payments
    this.abandonedPaymentTTLHours = this.configService.get<number>(
      'payments.abandonedPaymentTTLHours',
      72,
    );
  }

  /**
   * Scheduled job to clean up abandoned payment submissions
   * Runs daily at 2:00 AM
   *
   * Abandonment criteria:
   * - Payment status is PENDING or INITIATED
   * - Payment was created more than TTL hours ago
   * - Form data has not been deleted yet
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupAbandonedPayments(): Promise<void> {
    this.logger.log('Starting abandoned payment cleanup job');

    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(
        cutoffDate.getHours() - this.abandonedPaymentTTLHours,
      );

      // Find abandoned payments
      const abandonedPayments = await this.paymentRepository.find({
        where: [
          {
            status: PaymentStatus.PENDING,
            createdAt: LessThan(cutoffDate),
          },
          {
            status: PaymentStatus.INITIATED,
            createdAt: LessThan(cutoffDate),
          },
        ],
      });

      if (abandonedPayments.length === 0) {
        this.logger.log('No abandoned payments found');
        return;
      }

      this.logger.log(
        `Found ${abandonedPayments.length} abandoned payments to clean up`,
      );

      let cleanedCount = 0;
      let errorCount = 0;

      for (const payment of abandonedPayments) {
        try {
          await this.cleanupPayment(payment);
          cleanedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to cleanup payment ${payment.id}: ${error.message}`,
          );
          errorCount++;
        }
      }

      this.logger.log(
        `Abandoned payment cleanup completed: ${cleanedCount} cleaned, ${errorCount} errors`,
      );
    } catch (error) {
      this.logger.error('Abandoned payment cleanup job failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Clean up a single abandoned payment
   * - Securely delete encrypted form data
   * - Mark payment as cancelled
   */
  private async cleanupPayment(payment: Payment): Promise<void> {
    // Find associated form submission payment
    const formSubmissionPayment =
      await this.formSubmissionPaymentRepository.findOne({
        where: { paymentId: payment.id },
      });

    if (formSubmissionPayment && !formSubmissionPayment.formDataDeleted) {
      // Securely delete encrypted form data
      await this.formSubmissionPaymentRepository.update(
        { id: formSubmissionPayment.id },
        {
          encryptedFormData: null,
          formDataDeleted: true,
        },
      );

      this.logger.log(
        `Deleted encrypted form data for abandoned payment ${payment.id}`,
      );
    }

    // Update payment status to cancelled
    await this.paymentRepository.update(payment.id, {
      status: PaymentStatus.CANCELLED,
    });

    this.logger.log(
      `Marked payment ${payment.id} as cancelled (abandoned after ${this.abandonedPaymentTTLHours} hours)`,
    );
  }
}
