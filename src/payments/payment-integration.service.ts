import { Injectable, Logger } from '@nestjs/common';
import { EZPayService } from './ezpay/ezpay.service';
import { EZPayCartItem, CreatePaymentResult } from './ezpay/interfaces';

export interface PaymentIntegrationOptions {
  formId: string;
  submissionId: string;
  paymentCode: string;
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  reference?: string;
}

@Injectable()
export class PaymentIntegrationService {
  private readonly logger = new Logger(PaymentIntegrationService.name);

  constructor(private readonly ezpayService: EZPayService) {}

  /**
   * Create a payment for a form submission
   */
  async createPaymentForSubmission(
    options: PaymentIntegrationOptions,
  ): Promise<CreatePaymentResult> {
    const {
      formId,
      submissionId,
      paymentCode,
      amount,
      description,
      customerEmail,
      customerName,
      reference,
    } = options;

    this.logger.log(`Creating payment for form submission`, {
      formId,
      submissionId,
      amount,
      customerEmail,
    });

    // Create cart item for the form payment
    const cartItems: EZPayCartItem[] = [
      {
        code: paymentCode,
        amount,
        details: description,
        reference: reference || `${formId}-${submissionId}`,
      },
    ];

    try {
      const result = await this.ezpayService.createPayment({
        cartItems,
        customerEmail,
        customerName,
        referenceNumber: reference || `FORM-${formId}-${submissionId}`,
        processId: this.ezpayService.generateProcessId(),
        allowCredit: true,
        allowDebit: true,
        allowPayce: true,
      });

      if (result.success) {
        this.logger.log(`Payment created for submission ${submissionId}`, {
          token: result.token,
          referenceNumber: result.referenceNumber,
        });
      } else {
        // TypeScript doesn't narrow the type properly, so we assert the failure type
        const failureResult = result as {
          success: false;
          error: string;
          code?: string;
        };
        this.logger.error(
          `Payment creation failed for submission ${submissionId}`,
          {
            error: failureResult.error,
            code: failureResult.code,
          },
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to create payment for submission ${submissionId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Verify payment for a form submission
   */
  async verifyPaymentForSubmission(
    transactionNumber?: string,
    reference?: string,
  ) {
    this.logger.log('Verifying payment for form submission', {
      transactionNumber,
      reference,
    });

    try {
      const result = await this.ezpayService.verifyPayment({
        transactionNumber,
        reference,
      });

      if (result.success && result.data) {
        this.logger.log('Payment verification successful', {
          status: result.data._status,
          amount: result.data._amount,
          transactionNumber: result.data._transaction_number,
        });

        // Here you could update the form submission status based on payment status
        // Example: update database record, send confirmation email, etc.
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to verify payment for form submission', error);
      throw error;
    }
  }

  /**
   * Process payment callback for form submissions
   */
  async processPaymentCallback(callbackData: {
    _reference: string;
    _status: string;
    _transaction_number: string;
    _amount: string;
  }) {
    this.logger.log('Processing payment callback for form submission', {
      reference: callbackData._reference,
      status: callbackData._status,
      transactionNumber: callbackData._transaction_number,
    });

    try {
      // Extract form ID and submission ID from reference if it follows the pattern
      const referenceParts = callbackData._reference.split('-');
      if (referenceParts.length >= 3 && referenceParts[0] === 'FORM') {
        const formId = referenceParts[1];
        const submissionId = referenceParts[2];

        this.logger.log('Extracted form info from payment reference', {
          formId,
          submissionId,
          reference: callbackData._reference,
        });

        // Here you would typically:
        // 1. Update the form submission record with payment status
        // 2. Send confirmation emails to the user
        // 3. Trigger any post-payment processing workflows
        // 4. Update any related business logic

        if (callbackData._status === 'Success') {
          this.logger.log(
            `Payment successful for form ${formId}, submission ${submissionId}`,
          );
          // Handle successful payment
        } else if (callbackData._status === 'Failed') {
          this.logger.warn(
            `Payment failed for form ${formId}, submission ${submissionId}`,
          );
          // Handle failed payment
        }
      } else {
        this.logger.warn('Unable to extract form info from payment reference', {
          reference: callbackData._reference,
        });
      }

      return {
        status: 'processed',
        message: 'Payment callback processed successfully',
      };
    } catch (error) {
      this.logger.error('Failed to process payment callback', error);
      throw error;
    }
  }
}
