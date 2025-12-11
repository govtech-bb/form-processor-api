import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Payment,
  PaymentStatus,
  PaymentTransaction,
  TransactionStatus,
  TransactionProcessor,
  FormSubmissionPayment,
} from '../database/entities';
import { EZPayCallbackDto } from './ezpay/dto';
import { EZPayService } from './ezpay/ezpay.service';
import {
  VerifyPaymentParams,
  VerifyPaymentResult,
  EZPayVerifyResponse,
} from './ezpay/interfaces';

@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentTransaction)
    private transactionRepository: Repository<PaymentTransaction>,
    @InjectRepository(FormSubmissionPayment)
    private formSubmissionPaymentRepository: Repository<FormSubmissionPayment>,
    private ezpayService: EZPayService,
  ) {}

  /**
   * Verify payment status using EZPay API
   */
  async verifyPaymentStatus(
    params: VerifyPaymentParams,
  ): Promise<VerifyPaymentResult> {
    try {
      this.logger.log('Verifying payment status via EZPay API', params);

      const result = await this.ezpayService.verifyPayment(params);

      if (result.success && result.data) {
        this.logger.log('Payment verification successful', {
          transactionNumber: result.data._transaction_number,
          status: result.data._status,
          amount: result.data._amount,
        });
      } else {
        this.logger.warn('Payment verification failed or returned no data', {
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Payment verification error', {
        error: error.message,
        stack: error.stack,
        params,
      });

      return {
        success: false,
        error: `Payment verification failed: ${error.message}`,
      };
    }
  }

  /**
   * Process EZPay webhook callback
   */
  async processEZPayWebhook(
    callbackData: EZPayCallbackDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('Processing EZPay webhook callback', {
        reference: callbackData._reference,
        status: callbackData._status,
        transactionNumber: callbackData._transaction_number,
        amount: callbackData._amount,
      });

      // Find payment by reference number
      const payment = await this.paymentRepository.findOne({
        where: { referenceNumber: callbackData._reference },
        relations: ['formSubmissions'],
      });

      if (!payment) {
        this.logger.warn(
          `Payment not found for reference: ${callbackData._reference}`,
        );
        return {
          success: false,
          message: `Payment not found for reference: ${callbackData._reference}`,
        };
      }

      // Verify payment status with EZPay before processing
      const verificationResult = await this.verifyPaymentStatus({
        transactionNumber: callbackData._transaction_number,
        reference: callbackData._reference,
      });

      if (!verificationResult.success) {
        this.logger.error(
          'Payment verification failed - stopping webhook processing',
          {
            reference: callbackData._reference,
            transactionNumber: callbackData._transaction_number,
            error: verificationResult.error,
          },
        );

        return {
          success: false,
          message: `Payment verification failed: ${verificationResult.error}`,
        };
      }

      if (!verificationResult.data) {
        this.logger.error(
          'Payment verification succeeded but no data returned - stopping webhook processing',
          {
            reference: callbackData._reference,
            transactionNumber: callbackData._transaction_number,
          },
        );

        return {
          success: false,
          message: 'Payment verification succeeded but no data returned',
        };
      }

      // Compare webhook data with verification result
      const verifiedData = verificationResult.data;

      if (verifiedData._status !== callbackData._status) {
        this.logger.warn('Status mismatch between webhook and verification', {
          webhookStatus: callbackData._status,
          verifiedStatus: verifiedData._status,
          transactionNumber: callbackData._transaction_number,
        });
      }

      if (verifiedData._amount !== callbackData._amount) {
        this.logger.warn('Amount mismatch between webhook and verification', {
          webhookAmount: callbackData._amount,
          verifiedAmount: verifiedData._amount,
          transactionNumber: callbackData._transaction_number,
        });
      }

      this.logger.log(
        'Payment verification successful - proceeding with verified data',
        {
          transactionNumber: verifiedData._transaction_number,
          status: verifiedData._status,
          amount: verifiedData._amount,
        },
      );

      // Use verified data as source of truth
      const finalCallbackData: EZPayCallbackDto = {
        _reference: callbackData._reference,
        _status: verifiedData._status as any,
        _transaction_number: verifiedData._transaction_number,
        _ezpay_account: verifiedData._ezpay_account,
        _processor: verifiedData._processor as any,
        _datesettled: verifiedData._datesettled,
        _amount: verifiedData._amount,
        _pcode: callbackData._pcode,
      };
      const finalStatus = verifiedData._status;

      // Update or create transaction record using verified data as source of truth
      await this.upsertTransaction(payment.id, finalCallbackData);

      // Update payment status using verified status
      const newPaymentStatus = this.mapEZPayStatusToPaymentStatus(finalStatus);
      await this.updatePaymentStatus(payment.id, newPaymentStatus);

      // Update form submission payment status using verified status
      await this.updateFormSubmissionPaymentStatus(payment, finalStatus);

      // Process post-payment workflows using verified status
      if (finalStatus === 'Success') {
        await this.processSuccessfulPayment(payment, finalCallbackData);
      } else if (finalStatus === 'Failed') {
        await this.processFailedPayment(payment, finalCallbackData);
      }

      this.logger.log(
        `Webhook processed successfully for payment ${payment.id}`,
        {
          paymentId: payment.id,
          newStatus: newPaymentStatus,
          finalStatus: finalStatus,
          transactionNumber: finalCallbackData._transaction_number,
          verifiedDataUsed: true,
        },
      );

      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      this.logger.error('Failed to process EZPay webhook', {
        error: error.message,
        stack: error.stack,
        callbackData,
      });

      return {
        success: false,
        message: `Webhook processing failed: ${error.message}`,
      };
    }
  }

  /**
   * Create or update transaction record
   */
  private async upsertTransaction(
    paymentId: string,
    callbackData: EZPayCallbackDto,
  ): Promise<PaymentTransaction> {
    // Check if transaction already exists
    let transaction = await this.transactionRepository.findOne({
      where: { transactionNumber: callbackData._transaction_number },
    });

    const transactionData = {
      paymentId,
      transactionNumber: callbackData._transaction_number,
      ezpayAccount: callbackData._ezpay_account,
      processor: this.mapEZPayProcessorToEnum(callbackData._processor),
      status: callbackData._status as TransactionStatus,
      amount: parseFloat(callbackData._amount),
      dateSettled:
        callbackData._status === 'Success'
          ? new Date(callbackData._datesettled)
          : undefined,
      details: `Payment ${callbackData._status.toLowerCase()} via ${
        callbackData._processor
      }`,
      callbackData: callbackData as any,
    };

    if (transaction) {
      // Update existing transaction
      await this.transactionRepository.update(transaction.id, transactionData);
      transaction = { ...transaction, ...transactionData };
    } else {
      // Create new transaction
      transaction = this.transactionRepository.create(transactionData);
      transaction = await this.transactionRepository.save(transaction);
    }

    return transaction;
  }

  /**
   * Update payment status
   */
  private async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
  ): Promise<void> {
    await this.paymentRepository.update(paymentId, { status });
  }

  /**
   * Update form submission payment status
   */
  private async updateFormSubmissionPaymentStatus(
    payment: Payment,
    ezpayStatus: string,
  ): Promise<void> {
    const updates: Partial<FormSubmissionPayment> = {};

    if (ezpayStatus === 'Success') {
      updates.paymentCompleted = true;
      updates.paymentVerified = true;
    } else if (ezpayStatus === 'Failed') {
      updates.paymentCompleted = false;
      updates.paymentVerified = false;
    }

    if (Object.keys(updates).length > 0) {
      await this.formSubmissionPaymentRepository.update(
        { paymentId: payment.id },
        updates,
      );
    }
  }

  /**
   * Process successful payment workflows
   */
  private async processSuccessfulPayment(
    payment: Payment,
    callbackData: EZPayCallbackDto,
  ): Promise<void> {
    this.logger.log(
      `Processing successful payment workflows for ${payment.id}`,
      {
        amount: callbackData._amount,
        transactionNumber: callbackData._transaction_number,
      },
    );

    // Trigger additional workflows like:
    // - Send payment confirmation emails
    // - Update application status
    // - Trigger document generation
    // - Send notifications to relevant departments
    // - Update external systems

    // For now, we'll just mark notification as needed
    await this.formSubmissionPaymentRepository.update(
      { paymentId: payment.id },
      { notificationSent: false }, // This can be picked up by a notification job
    );
  }

  /**
   * Process failed payment workflows
   */
  private async processFailedPayment(
    payment: Payment,
    callbackData: EZPayCallbackDto,
  ): Promise<void> {
    this.logger.log(`Processing failed payment workflows for ${payment.id}`, {
      transactionNumber: callbackData._transaction_number,
    });

    // trigger failure workflows like:
    // - Send payment failure notifications
    // - Create retry opportunities
    // - Log for manual review
    // - Send alternative payment instructions
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
   * Map EZPay processor to internal enum
   */
  private mapEZPayProcessorToEnum(
    processor: string,
  ): TransactionProcessor | undefined {
    switch (processor) {
      case 'Credit Card':
        return TransactionProcessor.CREDIT_CARD;
      case 'Direct Debit':
        return TransactionProcessor.DIRECT_DEBIT;
      case 'Payce':
        return TransactionProcessor.PAYCE;
      case 'mMoney':
        return TransactionProcessor.MMONEY;
      default:
        return undefined;
    }
  }

  /**
   * Manually verify and synchronize payment status with EZPay
   * This method can be used for manual verification or periodic reconciliation
   */
  async manualPaymentVerification(paymentReference: string): Promise<{
    success: boolean;
    payment?: Payment;
    message: string;
  }> {
    try {
      this.logger.log(`Manual payment verification for: ${paymentReference}`);

      // Find the payment in our database
      const payment = await this.paymentRepository.findOne({
        where: { referenceNumber: paymentReference },
        relations: ['formSubmissions'],
      });

      if (!payment) {
        return {
          success: false,
          message: `Payment not found for reference: ${paymentReference}`,
        };
      }

      // Verify with EZPay
      const verificationResult = await this.verifyPaymentStatus({
        reference: paymentReference,
      });

      console.log('Verification Result:', verificationResult);

      if (!verificationResult.success || !verificationResult.data) {
        return {
          success: false,
          payment,
          message: `EZPay verification failed: ${verificationResult.error}`,
        };
      }

      const verifiedData = verificationResult.data;
      console.log('Verified Data:', verifiedData);

      // Check if status needs to be updated
      const currentStatus = payment.status;
      const verifiedStatus = this.mapEZPayStatusToPaymentStatus(
        verifiedData._status,
      );

      if (currentStatus !== verifiedStatus) {
        // Update payment status
        await this.updatePaymentStatus(payment.id, verifiedStatus);

        // Update form submission payment status
        await this.updateFormSubmissionPaymentStatus(
          payment,
          verifiedData._status,
        );

        // Create/update transaction record
        const callbackData: EZPayCallbackDto = {
          _reference: verifiedData._transaction_number,
          _status: verifiedData._status as any,
          _transaction_number: verifiedData._transaction_number,
          _ezpay_account: verifiedData._ezpay_account,
          _processor: verifiedData._processor as any,
          _datesettled: verifiedData._datesettled,
          _amount: verifiedData._amount,
          _pcode: '',
        };

        await this.upsertTransaction(payment.id, callbackData);

        this.logger.log(
          `Payment status updated from ${currentStatus} to ${verifiedStatus}`,
          {
            paymentId: payment.id,
            referenceNumber: paymentReference,
            transactionNumber: verifiedData._transaction_number,
          },
        );

        // Process workflows if payment became successful
        if (
          verifiedStatus === PaymentStatus.SUCCESS &&
          currentStatus !== PaymentStatus.SUCCESS
        ) {
          await this.processSuccessfulPayment(payment, callbackData);
        } else if (
          verifiedStatus === PaymentStatus.FAILED &&
          currentStatus !== PaymentStatus.FAILED
        ) {
          await this.processFailedPayment(payment, callbackData);
        }
      }

      return {
        success: true,
        payment,
        message: 'Payment verification successful',
      };
    } catch (error) {
      this.logger.error('Manual payment verification failed', {
        error: error.message,
        stack: error.stack,
        paymentReference,
      });

      return {
        success: false,
        message: `Manual verification failed: ${error.message}`,
      };
    }
  }

  /**
   * Verify payment by transaction number
   */
  async verifyPaymentByTransactionNumber(transactionNumber: string): Promise<{
    success: boolean;
    verificationResult?: EZPayVerifyResponse;
    message: string;
  }> {
    try {
      this.logger.log(
        `Verifying payment by transaction number: ${transactionNumber}`,
      );

      const verificationResult = await this.verifyPaymentStatus({
        transactionNumber,
      });

      if (!verificationResult.success || !verificationResult.data) {
        return {
          success: false,
          message: `EZPay verification failed: ${verificationResult.error}`,
        };
      }

      return {
        success: true,
        verificationResult: verificationResult.data,
        message: 'Payment verification successful',
      };
    } catch (error) {
      this.logger.error('Payment verification by transaction number failed', {
        error: error.message,
        transactionNumber,
      });

      return {
        success: false,
        message: `Verification failed: ${error.message}`,
      };
    }
  }

  /**
   * Get payment and transaction status for a form submission
   */
  async getPaymentStatusForSubmission(
    formId: string,
    submissionId: string,
  ): Promise<{
    hasPayment: boolean;
    payment?: Payment;
    transactions?: PaymentTransaction[];
    formSubmissionPayment?: FormSubmissionPayment;
  }> {
    const formSubmissionPayment =
      await this.formSubmissionPaymentRepository.findOne({
        where: { formId, submissionId },
        relations: ['payment'],
      });

    if (!formSubmissionPayment) {
      return { hasPayment: false };
    }

    const transactions = await this.transactionRepository.find({
      where: { paymentId: formSubmissionPayment.payment.id },
      order: { createdAt: 'DESC' },
    });

    return {
      hasPayment: true,
      payment: formSubmissionPayment.payment,
      transactions,
      formSubmissionPayment,
    };
  }
}
