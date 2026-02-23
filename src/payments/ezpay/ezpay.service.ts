import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { DepartmentMappingService } from '../department-mapping.service';
import {
  CreatePaymentParams,
  CreatePaymentResult,
  EZPayCartItem,
  EZPayConfig,
  EZPayTokenResponse,
  EZPayTransaction,
  EZPayVerifyResponse,
  QueryTransactionsResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
  EZPAY_ERROR_CODES,
} from './interfaces';
import {
  EZPayConfigurationException,
  EZPayNetworkException,
  EZPayTimeoutException,
  EZPayValidationException,
} from './exceptions';

@Injectable()
export class EZPayService {
  private readonly logger = new Logger(EZPayService.name);
  private readonly defaultConfig: EZPayConfig;

  constructor(
    private configService: ConfigService,
    private departmentMappingService: DepartmentMappingService,
  ) {
    this.defaultConfig = this.getDefaultConfig();
  }

  private getDefaultConfig(): EZPayConfig {
    const apiKey = this.configService.get<string>('ezpay.apiKey');
    const baseUrl = this.configService.get<string>('ezpay.baseUrl');

    if (!apiKey) {
      throw new EZPayConfigurationException('EZPAY_API_KEY is not configured');
    }
    if (!baseUrl) {
      throw new EZPayConfigurationException('EZPAY_BASE_URL is not configured');
    }

    return { apiKey, baseUrl };
  }

  /**
   * Get configuration with optional custom API key
   */
  private getConfigWithApiKey(customApiKey?: string): EZPayConfig {
    if (customApiKey) {
      return {
        apiKey: customApiKey,
        baseUrl: this.defaultConfig.baseUrl,
      };
    }
    return this.defaultConfig;
  }

  /**
   * Extract department from reference number
   * Expected format: DEPARTMENT|formId|submissionId (e.g., EDUCATION|form123|sub456)
   */
  private extractDepartmentFromReference(reference: string): string | null {
    // Check if reference follows the department format
    const match = reference.match(/^([A-Z_]+)\|(.+)\|(.+)$/);
    if (match) {
      return match[1].toLowerCase(); // Convert EDUCATION to education
    }

    this.logger.warn(
      `Reference ${reference} does not follow expected format DEPARTMENT|formId|submissionId. Using default API key.`,
    );
    return null;
  }

  /**
   * Get API key for a reference number by extracting department
   */
  private getApiKeyForReference(reference: string): string {
    const department = this.extractDepartmentFromReference(reference);
    if (department) {
      return this.departmentMappingService.getApiKeyForDepartment(department);
    }

    // Fallback to default API key
    return this.departmentMappingService.getApiKeyForDepartment('default');
  }

  /**
   * Generate a unique process ID (20 characters)
   * Uses cryptographically secure random bytes
   */
  generateProcessId(): string {
    const timestamp = Date.now().toString(36); // Base36 timestamp (~8 chars)
    const randomPart = crypto.randomBytes(6).toString('hex'); // 12 hex chars
    return (timestamp + randomPart).substring(0, 20);
  }

  /**
   * Get the payment page URL for a token
   */
  getPaymentPageUrl(token: string, customApiKey?: string): string {
    const config = this.getConfigWithApiKey(customApiKey);
    return `${config.baseUrl}/payment_page?token=${token}`;
  }

  /**
   * Build form data from an object
   */
  private buildFormData(data: Record<string, string>): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, value);
    }
    return formData;
  }

  /**
   * Make HTTP request with error handling
   */
  private async makeRequest<T>(url: string, options: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    try {
      this.logger.debug(`Making request to ${url}`);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new EZPayNetworkException(
          `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      const data = await response.json();

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new EZPayTimeoutException('Request timed out');
      }

      if (error instanceof EZPayNetworkException) {
        throw error;
      }

      this.logger.error('Request failed', error);
      throw new EZPayNetworkException(`Request failed: ${error.message}`);
    }
  }

  /**
   * Validate cart items
   */
  private validateCartItems(cartItems: EZPayCartItem[]): void {
    if (!cartItems || cartItems.length === 0) {
      throw new EZPayValidationException('No cart items provided', 'E-056');
    }

    for (const item of cartItems) {
      if (!item.code || !item.details || !item.reference) {
        throw new EZPayValidationException('Cart item missing required fields');
      }
      if (item.amount <= 0) {
        throw new EZPayValidationException(
          'Cart item amount must be greater than 0',
        );
      }
    }
  }

  /**
   * Create a payment session and get a token
   */
  async createPayment(
    params: CreatePaymentParams,
    customApiKey?: string,
  ): Promise<CreatePaymentResult> {
    const {
      cartItems,
      customerEmail,
      customerName,
      referenceNumber,
      processId = this.generateProcessId(),
      allowCredit = true,
      allowDebit = true,
      allowPayce = true,
    } = params;

    const config = this.getConfigWithApiKey(customApiKey);

    try {
      this.validateCartItems(cartItems);

      this.logger.log(`Creating payment for ${customerEmail}`);

      const formData = this.buildFormData({
        ez_cart_array: JSON.stringify(cartItems),
        ez_process_id: processId,
        ez_reference_email: customerEmail,
        ez_reference_name: customerName,
        ez_reference_number: referenceNumber,
        ez_allow_credit: String(allowCredit),
        ez_allow_debit: String(allowDebit),
        ez_allow_payce: String(allowPayce),
      });

      const response = await this.makeRequest<EZPayTokenResponse>(
        `${config.baseUrl}/ezpay_receivecart`,
        {
          method: 'POST',
          headers: {
            EZPluginKey: config.apiKey,
          },
          body: formData,
        },
      );

      if (response.error || !response.token) {
        const errorCode = response.code as keyof typeof EZPAY_ERROR_CODES;
        const errorMessage = errorCode
          ? EZPAY_ERROR_CODES[errorCode]
          : response.error || 'Unknown error';

        this.logger.error('Payment creation failed', {
          error: response.error,
          code: response.code,
        });

        return {
          success: false,
          error: errorMessage,
          code: response.code,
        };
      }

      const paymentUrl = this.getPaymentPageUrl(response.token);

      this.logger.log(`Payment created successfully: ${referenceNumber}`);

      return {
        success: true,
        token: response.token,
        paymentUrl,
        referenceNumber,
        processId,
      };
    } catch (error) {
      this.logger.error('Failed to create payment', error);

      if (error instanceof EZPayValidationException) {
        return {
          success: false,
          error: error.message,
          code: error.ezpayCode,
        };
      }

      throw error;
    }
  }

  /**
   * Verify a payment by transaction number or reference
   */
  async verifyPayment(
    params: VerifyPaymentParams,
    customApiKey?: string,
  ): Promise<VerifyPaymentResult> {
    if (!(params.transactionNumber || params.reference)) {
      throw new EZPayValidationException(
        'Either transactionNumber or reference is required',
      );
    }

    // Determine API key: use custom if provided, otherwise extract from reference
    let apiKey = customApiKey;
    if (!apiKey && params.reference) {
      apiKey = this.getApiKeyForReference(params.reference);
    }

    const config = this.getConfigWithApiKey(apiKey);

    try {
      this.logger.log('Verifying payment', params);

      const formData = new FormData();

      if (params.transactionNumber) {
        formData.append('transaction_number', params.transactionNumber);
      } else if (params.reference) {
        formData.append('reference', params.reference);
      }

      const response = await this.makeRequest<EZPayVerifyResponse>(
        `${config.baseUrl}/check_api`,
        {
          method: 'POST',
          headers: {
            EZPluginKey: config.apiKey,
          },
          body: formData,
        },
      );

      this.logger.log('Payment verification completed', response);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Payment verification failed', error);

      return {
        success: false,
        error: error.message || 'Payment verification failed',
      };
    }
  }

  /**
   * Query transactions within a date range
   */
  async queryTransactions(
    startDate: string,
    endDate: string,
    customApiKey?: string,
  ): Promise<QueryTransactionsResult> {
    const config = this.getConfigWithApiKey(customApiKey);

    try {
      this.logger.log(`Querying transactions from ${startDate} to ${endDate}`);

      const response = await this.makeRequest<EZPayTransaction[]>(
        `${config.baseUrl}/transactions_api`,
        {
          method: 'POST',
          headers: {
            Apikey: config.apiKey,
            Startdate: startDate,
            Enddate: endDate,
          },
        },
      );

      this.logger.log(`Retrieved ${response.length} transactions`);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Transaction query failed', error);

      return {
        success: false,
        error: error.message || 'Transaction query failed',
      };
    }
  }

  /**
   * Validate webhook signature (if webhook secret is configured)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validateWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = this.configService.get<string>('ezpay.webhookSecret');

    if (!webhookSecret) {
      this.logger.warn(
        'Webhook secret not configured - skipping signature validation',
      );
      return true;
    }

    // Update when EZPay provides signature generation details
    this.logger.debug('Validating webhook signature');
    return true;
  }
}
