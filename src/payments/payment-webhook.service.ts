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
  mapEZPayStatusToPaymentStatus,
} from './ezpay/interfaces';
import { FormUtilsService } from '../forms/form-utils.service';
import { ProcessorPipelineService } from '../processors/processor-pipeline.service';
import { decryptFormData, formatDisplayDate } from '../common/utils';

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
    private formUtilsService: FormUtilsService,
    private processorPipelineService: ProcessorPipelineService,
  ) {}

  /**
   * Verify payment status using EZPay API
   */
  async verifyPaymentStatus(
    params: VerifyPaymentParams,
    options?: { apiKey?: string },
  ): Promise<VerifyPaymentResult> {
    try {
      this.logger.log('Verifying payment status via EZPay API', params);

      const result = await this.ezpayService.verifyPayment(
        params,
        options?.apiKey,
      );

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
        _status: verifiedData._status,
        _transaction_number: verifiedData._transaction_number,
        _ezpay_account: verifiedData._ezpay_account,
        _processor: verifiedData._processor,
        _datesettled: verifiedData._datesettled,
        _amount: verifiedData._amount,
        _pcode: callbackData._pcode,
      };
      const finalStatus = verifiedData._status;

      // Update or create transaction record using verified data as source of truth
      await this.upsertTransaction(payment.id, finalCallbackData);

      // Update payment status using verified status
      const newPaymentStatus = mapEZPayStatusToPaymentStatus(
        finalStatus,
      ) as PaymentStatus;
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
   * Valid payment status transitions
   */
  private readonly validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
    [PaymentStatus.PENDING]: [
      PaymentStatus.INITIATED,
      PaymentStatus.SUCCESS,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
    ],
    [PaymentStatus.INITIATED]: [
      PaymentStatus.SUCCESS,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
    ],
    [PaymentStatus.SUCCESS]: [PaymentStatus.REFUNDED],
    [PaymentStatus.FAILED]: [PaymentStatus.PENDING], // Allow retry
    [PaymentStatus.CANCELLED]: [],
    [PaymentStatus.REFUNDED]: [],
  };

  /**
   * Check if a status transition is valid
   */
  private isValidTransition(
    currentStatus: PaymentStatus,
    newStatus: PaymentStatus,
  ): boolean {
    if (currentStatus === newStatus) {
      return true; // No change is always valid
    }
    return this.validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  /**
   * Update payment status with state machine validation
   */
  private async updatePaymentStatus(
    paymentId: string,
    newStatus: PaymentStatus,
  ): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (!this.isValidTransition(payment.status, newStatus)) {
      this.logger.warn(
        `Invalid status transition for payment ${paymentId}: ${payment.status} -> ${newStatus}`,
      );
      return;
    }

    await this.paymentRepository.update(paymentId, { status: newStatus });
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
    } else if (ezpayStatus === 'Failed') {
      updates.paymentCompleted = false;
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
   *
   * Workflow:
   * 1. Check idempotency (skip if already processed)
   * 2. Retrieve and decrypt form data
   * 3. Get email processors from form schema (separated by recipientType)
   * 4. Execute admin emails with full form data + payment info
   * 5. Execute user emails with payment confirmation only
   * 6. Delete encrypted form data after successful email delivery
   */
  private async processSuccessfulPayment(
    payment: Payment,
    callbackData: EZPayCallbackDto,
  ): Promise<void> {
    const formId = payment.metadata?.formId || '';
    const submissionId = payment.metadata?.submissionId || '';
    const formName = payment.metadata?.formName || 'Form Submission';

    this.logger.log(
      `Processing successful payment workflows for ${payment.id}`,
      {
        formId,
        submissionId,
        amount: callbackData._amount,
        transactionNumber: callbackData._transaction_number,
      },
    );

    // Get the form submission payment record
    const formSubmissionPayment =
      await this.formSubmissionPaymentRepository.findOne({
        where: { paymentId: payment.id },
      });

    if (!formSubmissionPayment) {
      this.logger.error(
        `FormSubmissionPayment not found for payment ${payment.id}`,
      );
      return;
    }

    // Idempotency check: skip if already processed
    if (formSubmissionPayment.notificationSent) {
      this.logger.log(
        `Payment ${payment.id} already processed (notification already sent), skipping`,
      );
      return;
    }

    if (formSubmissionPayment.formDataDeleted) {
      this.logger.warn(
        `Form data already deleted for payment ${payment.id}, cannot send emails`,
      );
      return;
    }

    let formData: Record<string, any> = {};
    if (formSubmissionPayment.encryptedFormData) {
      try {
        formData = decryptFormData(formSubmissionPayment.encryptedFormData);
      } catch (error) {
        this.logger.error(
          `Failed to decrypt form data for payment ${payment.id}`,
          { error: error.message },
        );
        return;
      }
    }

    // Get form schema with email processors
    let emailProcessors: any[] = [];
    try {
      const formSchema = await this.formUtilsService.getSchemaWithSecrets(
        formId,
        formData,
      );
      emailProcessors = formSchema.processors.filter(
        (processor) => processor.type === 'email',
      );
    } catch (error) {
      this.logger.error(`Failed to get form schema for ${formId}`, {
        error: error.message,
      });
      // Don't delete form data - allow retry when schema is available
      return;
    }

    // Separate email processors by recipientType
    const adminEmailProcessors = emailProcessors.filter(
      (p) => p.config.recipientType === 'admin',
    );
    const userEmailProcessors = emailProcessors.filter(
      (p) => p.config.recipientType === 'user',
    );
    // Processors without recipientType default to admin behavior (full form data)
    const untaggedEmailProcessors = emailProcessors.filter(
      (p) => !p.config.recipientType,
    );

    // Payment info shared by all emails
    const processedAt = formatDisplayDate(callbackData._datesettled);

    const paymentInfo = {
      paymentId: payment.id,
      referenceNumber: payment.referenceNumber,
      transactionNumber: callbackData._transaction_number,
      amount: callbackData._amount,
      processor: callbackData._processor,
      customerName: payment.customerName,
      customerEmail: payment.customerEmail,
      processedAt,
    };

    // Submission timestamp (when form was originally submitted)
    const submittedAt = formatDisplayDate(formSubmissionPayment.createdAt);

    // Context for admin emails: includes full form data + payment info
    const adminContext = {
      formId,
      submissionId,
      data: {
        ...formData,
        formName,
        submittedAt,
        paymentInfo,
      },
    };

    // Context for user emails: only payment confirmation, no PII form data
    const userContext = {
      formId,
      submissionId,
      data: {
        formName,
        submittedAt,
        paymentInfo,
      },
    };

    let emailsSentSuccessfully = true;

    const adminProcessors = [
      ...adminEmailProcessors,
      ...untaggedEmailProcessors,
    ];
    if (adminProcessors.length > 0) {
      try {
        await this.processorPipelineService.execute(
          adminProcessors,
          adminContext,
        );
        this.logger.log(
          `Admin email processors (${adminProcessors.length}) executed successfully for payment ${payment.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to execute admin email processors for payment ${payment.id}`,
          { error: error.message },
        );
        emailsSentSuccessfully = false;
      }
    }

    if (userEmailProcessors.length > 0) {
      try {
        await this.processorPipelineService.execute(
          userEmailProcessors,
          userContext,
        );
        this.logger.log(
          `User email processors (${userEmailProcessors.length}) executed successfully for payment ${payment.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to execute user email processors for payment ${payment.id}`,
          { error: error.message },
        );
        emailsSentSuccessfully = false;
      }
    }

    if (emailProcessors.length === 0) {
      this.logger.log(
        `No email processors configured for form ${formId}, skipping emails`,
      );
    }

    // Only delete form data and mark as sent if emails were successful
    if (emailsSentSuccessfully) {
      // Securely delete encrypted form data
      await this.formSubmissionPaymentRepository.update(
        { id: formSubmissionPayment.id },
        {
          encryptedFormData: null,
          formDataDeleted: true,
          notificationSent: true,
        },
      );

      this.logger.log(
        `Form data securely deleted for payment ${payment.id} after successful email delivery`,
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
    apiKey?: string,
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
      const verificationResult = await this.verifyPaymentStatus(
        {
          transactionNumber,
          reference,
        },
        { apiKey },
      );

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
      const verifiedStatus = mapEZPayStatusToPaymentStatus(
        paymentData._status,
      ) as PaymentStatus;

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
          _status: paymentData._status,
          _transaction_number: paymentData._transaction_number,
          _ezpay_account: paymentData._ezpay_account,
          _processor: paymentData._processor,
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
}
