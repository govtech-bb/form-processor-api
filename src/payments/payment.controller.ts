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
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { EZPayService } from './ezpay/ezpay.service';
import { EZPayCallbackDto } from './ezpay/dto';
import { EZPayException } from './ezpay/exceptions';
import { PaymentWebhookService } from './payment-webhook.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly ezpayService: EZPayService,
    private readonly paymentWebhookService: PaymentWebhookService,
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
    payment?: any;
    verificationResult?: any;
    message: string;
  }> {
    try {
      this.logger.log(`Getting transaction status for reference: ${reference}`);

      // Use the payment webhook service to verify the payment
      const result = await this.paymentWebhookService.manualPaymentVerification(
        reference,
      );

      if (!result.success) {
        this.logger.warn(
          `Transaction status retrieval failed: ${result.message}`,
          {
            reference,
          },
        );

        return {
          success: false,
          message: result.message,
        };
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to get transaction status', {
        error: error.message,
        reference,
      });

      return {
        success: false,
        message: `Failed to get transaction status: ${error.message}`,
      };
    }
  }
}
