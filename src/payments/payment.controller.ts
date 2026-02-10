import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Redirect,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { EZPayService } from './ezpay/ezpay.service';
import { EZPayCallbackDto } from './ezpay/dto';
import { EZPayException } from './ezpay/exceptions';
import { PaymentWebhookService } from './payment-webhook.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly ezpayService: EZPayService,
    private readonly paymentWebhookService: PaymentWebhookService,
    private readonly reconciliationService: PaymentReconciliationService,
    private readonly configService: ConfigService,
  ) {}

  @Post('ezpay/webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() callbackDto: EZPayCallbackDto,
    @Headers('x-ezpay-signature') signature?: string,
    @Req() request?: Request,
  ): Promise<{ status: string; message: string }> {
    try {
      this.logger.log('Received EZPay webhook', {
        reference: callbackDto._reference,
        status: callbackDto._status,
        transactionNumber: callbackDto._transaction_number,
      });

      // Validate webhook signature if configured
      if (signature && request) {
        const payload = JSON.stringify(request.body);
        const isValid = this.ezpayService.validateWebhookSignature(
          payload,
          signature,
        );

        if (!isValid) {
          this.logger.error('Invalid webhook signature');
          throw new EZPayException(
            'Invalid webhook signature',
            HttpStatus.UNAUTHORIZED,
          );
        }
      }

      // Process the webhook using the payment webhook service
      const result = await this.paymentWebhookService.processEZPayWebhook(
        callbackDto,
      );

      if (!result.success) {
        this.logger.error('Webhook processing failed', {
          error: result.message,
          reference: callbackDto._reference,
        });

        throw new EZPayException(
          `Webhook processing failed: ${result.message}`,
        );
      }

      this.logger.log('Webhook processed successfully', {
        reference: callbackDto._reference,
        status: callbackDto._status,
      });

      return {
        status: 'success',
        message: result.message,
      };
    } catch (error) {
      this.logger.error('Failed to process webhook', error);

      if (error instanceof EZPayException) {
        throw error;
      }

      throw new EZPayException('Failed to process webhook');
    }
  }

  @Get('status/:reference')
  @HttpCode(HttpStatus.OK)
  async getTransactionStatus(@Param('reference') reference: string): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    const result = await this.paymentWebhookService.manualPaymentVerification(
      undefined,
      reference,
    );

    return result;
  }

  @Get('verify')
  @HttpCode(HttpStatus.OK)
  async verifyPayment(
    @Query('transactionNumber') transactionNumber?: string,
    @Query('reference') reference?: string,
  ): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    const result = await this.paymentWebhookService.manualPaymentVerification(
      transactionNumber,
      reference,
    );

    return result;
  }

  @Post('reconcile/:department')
  @HttpCode(HttpStatus.OK)
  async reconcileDepartment(
    @Param('department') department: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<{
    success: boolean;
    message: string;
    data?: { reconciled: number; updated: number };
  }> {
    this.logger.log(
      `Manual reconciliation triggered for department: ${department}`,
    );

    const result =
      await this.reconciliationService.triggerDepartmentReconciliation(
        department,
        startDate,
        endDate,
      );

    return result;
  }

  /**
   * EZPay redirect endpoint
   * Called when users complete payment on EZPay and are redirected back
   *
   * Expected query params:
   * - rid: reference number (e.g., DEPARTMENT|formId|submissionId)
   * - tx: transaction number
   * - payment_status: "Success" | "Failed" | "Initiated"
   */
  @Get('ezpay/redirect')
  @Redirect()
  async handleEZPayRedirect(
    @Query('rid') referenceNumber?: string,
    @Query('tx') transactionNumber?: string,
    @Query('payment_status') paymentStatus?: 'Success' | 'Failed' | 'Initiated',
  ): Promise<{ url: string }> {
    const frontendUrl = this.configService.get<string>('app.frontendUrl');

    // Extract formId from reference number
    // Expected format: DEPARTMENT|formId|submissionId
    let formId: string | null = null;
    if (referenceNumber) {
      const parts = referenceNumber.split('|');
      if (parts.length >= 2) {
        formId = parts[1]; // Extract formId from middle part
      }
    }

    // Build redirect URL
    const redirectUrl = new URL('/api/payments/ezpay/redirect', frontendUrl);

    if (formId) {
      redirectUrl.searchParams.set('formId', formId);
    }
    if (referenceNumber) {
      redirectUrl.searchParams.set('rid', referenceNumber);
    }
    if (transactionNumber) {
      redirectUrl.searchParams.set('tx', transactionNumber);
    }
    if (paymentStatus) {
      redirectUrl.searchParams.set('paymentStatus', paymentStatus);
    }

    return { url: redirectUrl.toString() };
  }
}
