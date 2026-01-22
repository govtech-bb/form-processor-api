import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Payment, PaymentStatus } from '../database/entities';
import { EZPayService } from './ezpay/ezpay.service';
import { PaymentWebhookService } from './payment-webhook.service';
import { DepartmentMappingService } from './department-mapping.service';
import { EZPayTransaction } from './ezpay/interfaces';

@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);
  private isRunning = false;

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private ezpayService: EZPayService,
    private paymentWebhookService: PaymentWebhookService,
    private departmentMappingService: DepartmentMappingService,
  ) {}

  /**
   * Cron job that runs every 5 minutes to reconcile transactions
   * Queries EZPay for today's transactions and triggers webhook flow for any
   * transactions that need to be updated
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcileTransactions(): Promise<void> {
    // Prevent concurrent execution
    if (this.isRunning) {
      this.logger.warn(
        'Reconciliation job already running, skipping this execution',
      );
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting payment reconciliation job');

    try {
      const { startDate, endDate } = this.getTodayDateRange();

      // Get all configured department API keys
      const departments =
        this.departmentMappingService.getAvailableDepartments();

      // Build list of department queries to run in parallel
      const departmentQueries: Array<{
        department: string;
        apiKey: string;
      }> = [];

      for (const { department, hasApiKey } of departments) {
        if (!hasApiKey) {
          continue;
        }

        const apiKey =
          this.departmentMappingService.getApiKeyForDepartment(department);
        departmentQueries.push({ department, apiKey });
      }

      this.logger.log(
        `Querying ${departmentQueries.length} departments in parallel`,
      );

      // Run all department queries in parallel
      const results = await Promise.allSettled(
        departmentQueries.map(({ department, apiKey }) =>
          this.reconcileDepartmentTransactions(
            startDate,
            endDate,
            apiKey,
            department,
          ),
        ),
      );

      // Aggregate results
      let totalReconciled = 0;
      let totalUpdated = 0;

      results.forEach((result, index) => {
        const { department } = departmentQueries[index];
        if (result.status === 'fulfilled') {
          totalReconciled += result.value.reconciled;
          totalUpdated += result.value.updated;
        } else {
          this.logger.error(
            `Failed to reconcile transactions for department: ${department}`,
            { error: result.reason?.message },
          );
        }
      });

      this.logger.log(
        `Payment reconciliation completed. Processed: ${totalReconciled}, Updated: ${totalUpdated}`,
      );
    } catch (error) {
      this.logger.error('Payment reconciliation job failed', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Reconcile transactions for a specific department/API key
   */
  private async reconcileDepartmentTransactions(
    startDate: string,
    endDate: string,
    apiKey: string,
    department: string,
  ): Promise<{ reconciled: number; updated: number }> {
    this.logger.log(`Querying transactions for department: ${department}`);

    const queryResult = await this.ezpayService.queryTransactions(
      startDate,
      endDate,
      apiKey,
    );

    if (!queryResult.success || !queryResult.data) {
      this.logger.warn(
        `Failed to query transactions for department ${department}: ${queryResult.error}`,
      );
      return { reconciled: 0, updated: 0 };
    }

    const transactions = queryResult.data;
    this.logger.log(
      `Found ${transactions.length} transactions for department ${department}`,
    );

    let reconciled = 0;
    let updated = 0;

    for (const transaction of transactions) {
      reconciled++;

      try {
        const wasUpdated = await this.processTransaction(transaction);
        if (wasUpdated) {
          updated++;
        }
      } catch (error) {
        this.logger.error(
          `Failed to process transaction ${transaction.TransactionCode}`,
          { error: error.message },
        );
      }
    }

    return { reconciled, updated };
  }

  /**
   * Process a single transaction from EZPay query
   * Returns true if the payment was updated
   */
  private async processTransaction(
    transaction: EZPayTransaction,
  ): Promise<boolean> {
    const transactionNumber = transaction.TransactionCode;
    const ezpayStatus = transaction.Status;

    // Extract reference from transaction details if available
    const reference = this.extractReferenceFromTransaction(transaction);

    if (!reference) {
      this.logger.debug(
        `No reference found for transaction ${transactionNumber}, skipping`,
      );
      return false;
    }

    // Find the payment in our database
    const payment = await this.paymentRepository.findOne({
      where: { referenceNumber: reference },
    });

    if (!payment) {
      this.logger.debug(
        `Payment not found for reference ${reference}, skipping`,
      );
      return false;
    }

    // Check if status needs to be updated
    const currentStatus = payment.status;
    const newStatus = this.mapEZPayStatusToPaymentStatus(ezpayStatus);

    // Only process if status is different and payment is not already in final state
    if (currentStatus === newStatus) {
      return false;
    }

    // Skip if payment is already in a final successful state
    if (
      currentStatus === PaymentStatus.SUCCESS &&
      newStatus !== PaymentStatus.REFUNDED
    ) {
      return false;
    }

    this.logger.log(
      `Reconciling payment ${payment.id}: ${currentStatus} -> ${newStatus}`,
      {
        transactionNumber,
        reference,
      },
    );

    // Use manual verification to update the payment and trigger workflows
    const result = await this.paymentWebhookService.manualPaymentVerification(
      transactionNumber,
      reference,
    );

    if (result.success) {
      this.logger.log(`Successfully reconciled payment ${payment.id}`);
      return true;
    } else {
      this.logger.warn(
        `Failed to reconcile payment ${payment.id}: ${result.message}`,
      );
      return false;
    }
  }

  /**
   * Extract reference number from EZPay transaction
   * The reference is typically stored in the Cart items as JSON strings
   */
  private extractReferenceFromTransaction(
    transaction: EZPayTransaction,
  ): string | null {
    // Try to extract from Cart items if available
    if (transaction.Cart && Array.isArray(transaction.Cart)) {
      for (const item of transaction.Cart) {
        try {
          // Cart items may be JSON strings that need parsing
          const cartItem = typeof item === 'string' ? JSON.parse(item) : item;
          if (cartItem.reference && typeof cartItem.reference === 'string') {
            return cartItem.reference;
          }
        } catch {
          // Skip items that can't be parsed
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Map EZPay status to internal payment status
   */
  private mapEZPayStatusToPaymentStatus(ezpayStatus: string): PaymentStatus {
    switch (ezpayStatus) {
      case 'Success':
        return PaymentStatus.SUCCESS;
      case 'Failed':
        return PaymentStatus.FAILED;
      case 'Initiated':
        return PaymentStatus.INITIATED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  /**
   * Get today's date range in YYYY-MM-DD HH:mm format
   */
  private getTodayDateRange(): { startDate: string; endDate: string } {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return {
      startDate: `${dateStr} 00:00`,
      endDate: `${dateStr} 23:59`,
    };
  }

  /**
   * Manual trigger for reconciliation (can be called via API endpoint)
   */
  async triggerReconciliation(): Promise<{
    success: boolean;
    message: string;
  }> {
    if (this.isRunning) {
      return {
        success: false,
        message: 'Reconciliation job is already running',
      };
    }

    // Run in background
    this.reconcileTransactions();

    return {
      success: true,
      message: 'Reconciliation job triggered',
    };
  }
}
