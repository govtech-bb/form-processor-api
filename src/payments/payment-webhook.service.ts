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
import { EmailService } from '../email/email.service';

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
    private emailService: EmailService,
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
      accountCode: callbackData._ezpay_account,
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

    // Send payment confirmation email if confirmationEmailTo is configured
    await this.sendPaymentConfirmationEmail(payment, callbackData);

    // Mark notification as sent
    await this.formSubmissionPaymentRepository.update(
      { paymentId: payment.id },
      { notificationSent: true },
    );
  }

  /**
   * Send payment confirmation emails to admin and customer
   */
  private async sendPaymentConfirmationEmail(
    payment: Payment,
    callbackData: EZPayCallbackDto,
  ): Promise<void> {
    const adminEmails: string[] = payment.metadata?.confirmationEmailTo || [];
    const customerEmail = payment.metadata?.configCustomerEmail;
    const formName = payment.metadata?.formName || 'Form Submission';
    const formId = payment.metadata?.formId || '';
    const submissionId = payment.metadata?.submissionId || '';

    const emailData = {
      formName,
      formId,
      submissionId,
      referenceNumber: payment.referenceNumber,
      transactionNumber: callbackData._transaction_number,
      amount: callbackData._amount,
      processor: callbackData._processor,
      customerName: payment.customerName,
      customerEmail: payment.customerEmail,
      description: payment.description,
    };

    // Send admin emails (using admin template)
    const uniqueAdminEmails = [...new Set(adminEmails.filter(Boolean))];
    for (const adminEmail of uniqueAdminEmails) {
      try {
        await this.emailService.sendEmail({
          to: adminEmail,
          subject: `${formName} payment (reference number: ${submissionId})`,
          template: 'payment-confirmation',
          data: emailData,
        });

        this.logger.log(
          `Admin payment confirmation email sent to ${adminEmail} for payment ${payment.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send admin payment confirmation email to ${adminEmail} for payment ${payment.id}`,
          { error: error.message },
        );
      }
    }

    // Send customer email (using customer-friendly template)
    if (customerEmail) {
      try {
        await this.emailService.sendEmail({
          to: customerEmail,
          subject: `Thank you for your request`,
          template: 'payment-confirmation-customer',
          data: emailData,
        });

        this.logger.log(
          `Customer payment confirmation email sent to ${customerEmail} for payment ${payment.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send customer payment confirmation email to ${customerEmail} for payment ${payment.id}`,
          { error: error.message },
        );
      }
    }

    if (uniqueAdminEmails.length === 0 && !customerEmail) {
      this.logger.log(
        `No email recipients configured for payment ${payment.id}, skipping email`,
      );
    }
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
   * Parse and serialize EZPay verification details
   * Accepts the '_details' field from EZPayVerifyResponse, which is a JSON stringified array.
   * Returns a normalized object with expected fields.
   */
  private serializeVerificationDetails(
    verifiedData: EZPayVerifyResponse['_details'],
  ): {
    AMOUNT_DUE: string;
    EZPAY_ACCOUNT: string;
    HEADER: string;
    ITEMS: string;
    NAME: string;
    amount: number;
    code: string;
    details: string;
    reference: string;
    reference_email: string;
    reference_name: string;
    reference_number: string;
    token: string;
  } | null {
    if (!verifiedData) return null;
    try {
      // _details is a JSON stringified array, e.g. '["{...}"]'
      const parseArray = JSON.parse(verifiedData);
      if (!Array.isArray(parseArray) || !parseArray[0]) return null;
      const parsedData = JSON.parse(parseArray[0]);
      return {
        AMOUNT_DUE: parsedData.AMOUNT_DUE,
        EZPAY_ACCOUNT: parsedData.EZPAY_ACCOUNT,
        HEADER: parsedData.HEADER,
        ITEMS: parsedData.ITEMS,
        NAME: parsedData.NAME,
        amount: parsedData.amount,
        code: parsedData.code,
        details: parsedData.details,
        reference: parsedData.reference,
        reference_email: parsedData.reference_email,
        reference_name: parsedData.reference_name,
        reference_number: parsedData.reference_number,
        token: parsedData.token,
      };
    } catch (e) {
      this.logger.error('Failed to parse EZPay verification details', {
        error: e.message,
        verifiedData,
      });
      return null;
    }
  }

  /**
   * Manually verify and synchronize payment status with EZPay
   * This method can be used for manual verification or periodic reconciliation
   */
  async manualPaymentVerification(
    transactionNumber?: string,
    reference?: string,
  ): Promise<{
    success: boolean;
    message: string;
    data?: Payment;
  }> {
    try {
      // Validate that both parameters are provided
      if (!transactionNumber || !reference) {
        return {
          success: false,
          message: 'Both transactionNumber and reference must be provided',
        };
      }

      // Verify with EZPay
      const verificationResult = await this.verifyPaymentStatus({
        transactionNumber,
        reference,
      });

      if (!verificationResult.success || !verificationResult.data) {
        return {
          success: false,
          message: `EZPay verification failed: ${verificationResult.error}`,
        };
      }

      const { data: paymentData } = verificationResult;
      const serializedDetails = this.serializeVerificationDetails(
        paymentData._details,
      );

      // Find the payment in our database
      let payment: Payment | null = null;

      if (serializedDetails?.reference) {
        // Use reference from verified data if available
        payment = await this.paymentRepository.findOne({
          where: {
            referenceNumber: serializedDetails.reference,
          },
          relations: ['formSubmissions'],
        });
      } else if (reference) {
        // Use provided reference parameter
        payment = await this.paymentRepository.findOne({
          where: {
            referenceNumber: reference,
          },
          relations: ['formSubmissions'],
        });
      }

      if (!payment) {
        const usedReference =
          serializedDetails?.reference || reference || 'unknown';
        return {
          success: false,
          message: `Payment not found for reference: ${usedReference}`,
        };
      }

      // Check if status needs to be updated
      const currentStatus = payment.status;
      const verifiedStatus = this.mapEZPayStatusToPaymentStatus(
        paymentData._status,
      );

      if (currentStatus !== verifiedStatus) {
        // Update payment status
        await this.updatePaymentStatus(payment.id, verifiedStatus);

        // Update form submission payment status
        await this.updateFormSubmissionPaymentStatus(
          payment,
          paymentData._status,
        );

        // Create/update transaction record
        const callbackData: EZPayCallbackDto = {
          _reference: serializedDetails?.reference || reference || '',
          _status: paymentData._status as any,
          _transaction_number: paymentData._transaction_number,
          _ezpay_account: paymentData._ezpay_account,
          _processor: paymentData._processor as any,
          _datesettled: paymentData._datesettled,
          _amount: paymentData._amount,
          _pcode: '',
        };

        await this.upsertTransaction(payment.id, callbackData);

        this.logger.log(
          `Payment status updated from ${currentStatus} to ${verifiedStatus}`,
          {
            paymentId: payment.id,
            referenceNumber: serializedDetails?.reference || reference,
            transactionNumber: paymentData._transaction_number,
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
        data: await this.paymentRepository.findOne({
          where: { id: payment.id },
          relations: ['formSubmissions'],
        }),
        message: 'Payment verification successful',
      };
    } catch (error) {
      this.logger.error('Manual payment verification failed', {
        error: error.message,
        stack: error.stack,
        transactionNumber,
        reference,
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
