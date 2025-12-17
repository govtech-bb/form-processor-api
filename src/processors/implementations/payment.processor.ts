import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EZPayService } from '../../payments/ezpay/ezpay.service';
import { DepartmentMappingService } from '../../payments/department-mapping.service';
import {
  Payment,
  PaymentStatus,
  PaymentProvider,
  FormSubmissionPayment,
} from '../../database/entities';
import {
  PaymentProcessorConfig,
  ResponseDataConfig,
} from '../../forms/interfaces/form-schema.interface';
import { IProcessor } from '../interfaces/processor.interface';

export interface PaymentProcessorResult {
  success: boolean;
  paymentRequired: boolean;
  paymentUrl?: string;
  paymentToken?: string;
  paymentId?: string;
  referenceNumber?: string;
  amount?: number;
  description?: string;
  error?: string;
  additionalData?: Record<string, any>;
}

@Injectable()
export class PaymentProcessor implements IProcessor {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(FormSubmissionPayment)
    private formSubmissionPaymentRepository: Repository<FormSubmissionPayment>,
    private ezpayService: EZPayService,
    private configService: ConfigService,
    private departmentMappingService: DepartmentMappingService,
  ) {}

  get type(): string {
    return 'payment';
  }

  async execute(
    config: PaymentProcessorConfig['config'],
    context: {
      formId: string;
      submissionId: string;
      data: Record<string, any>;
    },
  ): Promise<any> {
    const result = await this.process(config, config, context);
    if (!result.success) {
      throw new Error(result.error || 'Payment processing failed');
    }
    return result;
  }

  async process(
    formData: Record<string, any>,
    config: PaymentProcessorConfig['config'],
    context: {
      formId: string;
      submissionId: string;
    },
  ): Promise<PaymentProcessorResult> {
    try {
      this.logger.log(`Processing payment for form ${context.formId}`, {
        submissionId: context.submissionId,
        formId: context.formId,
      });

      // Resolve configuration values
      const resolvedConfig = await this.resolveConfig(config, formData);

      // Validate payment configuration
      if (!resolvedConfig.paymentCode) {
        throw new Error('Payment code not configured or resolved');
      }

      if (!resolvedConfig.amount || resolvedConfig.amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      // Extract customer information from form data
      const customerInfo = this.extractCustomerInfo(formData);

      // Create payment record
      const payment = await this.createPaymentRecord({
        ...resolvedConfig,
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        formId: context.formId,
        submissionId: context.submissionId,
      });

      // Create EZPay payment session
      const ezpayResult = await this.ezpayService.createPayment(
        {
          cartItems: [
            {
              code: resolvedConfig.paymentCode,
              amount: resolvedConfig.amount,
              details: resolvedConfig.description,
              reference: payment.referenceNumber,
            },
          ],
          customerEmail: customerInfo.email,
          customerName: customerInfo.name,
          referenceNumber: payment.referenceNumber,
          processId: payment.processId,
          allowCredit: resolvedConfig.allowCredit ?? true,
          allowDebit: resolvedConfig.allowDebit ?? true,
          allowPayce: resolvedConfig.allowPayce ?? true,
        },
        resolvedConfig.apiKey,
      );

      if (!ezpayResult.success) {
        // Update payment status to failed
        const failedResult = ezpayResult as {
          success: false;
          error: string;
          code?: string;
        };
        await this.updatePaymentStatus(payment.id, PaymentStatus.FAILED, {
          error: failedResult.error,
          code: failedResult.code,
        });

        return {
          success: false,
          paymentRequired: true,
          error: `Payment creation failed: ${failedResult.error}`,
        };
      }

      // Update payment with EZPay response
      const successResult = ezpayResult as {
        success: true;
        token: string;
        paymentUrl: string;
        referenceNumber: string;
        processId: string;
      };
      await this.updatePaymentWithToken(
        payment.id,
        successResult.token,
        successResult.paymentUrl,
      );

      // Create form submission payment link
      await this.createFormSubmissionPayment(
        context.formId,
        context.submissionId,
        payment.id,
      );

      this.logger.log(
        `Payment created successfully for submission ${context.submissionId}`,
        {
          paymentId: payment.id,
          referenceNumber: payment.referenceNumber,
          amount: resolvedConfig.amount,
        },
      );

      // Process additional response data if configured
      const additionalData = config.responseData
        ? await this.processResponseData(config.responseData, formData)
        : undefined;

      return {
        success: true,
        paymentRequired: true,
        paymentUrl: successResult.paymentUrl,
        paymentToken: successResult.token,
        paymentId: payment.id,
        referenceNumber: payment.referenceNumber,
        amount: resolvedConfig.amount,
        description: resolvedConfig.description,
        additionalData,
      };
    } catch (error) {
      this.logger.error(
        `Payment processing failed for submission ${context.submissionId}`,
        error,
      );

      return {
        success: false,
        paymentRequired: true,
        error: error.message || 'Payment processing failed',
      };
    }
  }

  private async resolveConfig(
    config: PaymentProcessorConfig['config'],
    formData: Record<string, any>,
  ): Promise<{
    department: string;
    paymentCode: string;
    amount: number;
    description: string;
    allowCredit: boolean;
    allowDebit: boolean;
    allowPayce: boolean;
    apiKey: string;
  }> {
    // Resolve payment code from database secrets
    let paymentCode = config.paymentCode;
    if (paymentCode.startsWith('{{db:')) {
      paymentCode = await this.resolveDbSecret(paymentCode);
    }

    // Resolve amount (could be dynamic based on form data)
    let amount = config.amount;
    if (typeof amount === 'string') {
      amount = await this.evaluateAmountFormula(amount, formData);
    }

    // Get the department and corresponding API key
    const department = config.department || 'default';
    const apiKey =
      this.departmentMappingService.getApiKeyForDepartment(department);

    return {
      department,
      paymentCode,
      amount: Number(amount),
      description: config.description,
      allowCredit: config.allowCredit ?? true,
      allowDebit: config.allowDebit ?? true,
      allowPayce: config.allowPayce ?? true,
      apiKey,
    };
  }

  private async resolveDbSecret(secretRef: string): Promise<string> {
    // Extract secret path from {{db:form-id:secret-key}} format
    const match = secretRef.match(/\{\{db:([^:]+):([^}]+)\}\}/);
    if (!match) {
      throw new Error(`Invalid secret reference format: ${secretRef}`);
    }

    const [, formId, secretKey] = match;

    // This would typically query your form config or secrets table
    // For now, using environment variables as fallback
    const envKey = `${formId
      .toUpperCase()
      .replace(/-/g, '_')}_${secretKey.toUpperCase()}`;
    const value = this.configService.get<string>(envKey);

    if (!value) {
      throw new Error(`Secret not found: ${secretRef} (tried ${envKey})`);
    }

    return value;
  }

  private async evaluateAmountFormula(
    formula: string,
    formData: Record<string, any>,
  ): Promise<number> {
    // Handle simple field references
    if (formula.startsWith('{{formData.') && formula.endsWith('}}')) {
      const path = formula.slice(12, -2); // Remove {{formData. and }}

      // Check if it's a mathematical expression
      if (
        path.includes('*') ||
        path.includes('+') ||
        path.includes('-') ||
        path.includes('/')
      ) {
        return await this.evaluateMathExpression(path, formData);
      }

      // Simple field reference
      const value = this.getNestedValue(formData, path);
      return Number(value) || 0;
    }

    // If it's just a number as string
    return Number(formula) || 0;
  }

  private async evaluateMathExpression(
    expression: string,
    formData: Record<string, any>,
  ): Promise<number> {
    // Replace form field references and database references with their values
    let processedExpression = expression;

    // First, resolve any database references (e.g., db:get-birth-certificate:payment_amount)
    const dbReferencePattern = /db:[^:]+:[^}\s+\-*/()]+/g;
    const dbMatches = expression.match(dbReferencePattern);

    if (dbMatches) {
      for (const dbMatch of dbMatches) {
        try {
          const dbValue = await this.resolveDbSecret(`{{${dbMatch}}}`);
          const numericDbValue = Number(dbValue) || 0;
          processedExpression = processedExpression.replace(
            new RegExp(dbMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            numericDbValue.toString(),
          );
        } catch (error) {
          this.logger.warn(
            `Failed to resolve database reference: ${dbMatch}`,
            error,
          );
          // Replace with 0 if resolution fails
          processedExpression = processedExpression.replace(
            new RegExp(dbMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            '0',
          );
        }
      }
    }

    // Then, find all field references in the expression (e.g., order.numberOfCopies)
    const fieldReferencePattern = /[a-zA-Z][a-zA-Z0-9._]*/g;
    const matches = processedExpression.match(fieldReferencePattern);

    if (matches) {
      for (const match of matches) {
        // Skip if it's a number
        if (/^\d+\.?\d*$/.test(match)) continue;

        const value = this.getNestedValue(formData, match);
        const numericValue = Number(value) || 0;
        processedExpression = processedExpression.replace(
          new RegExp(`\\b${match}\\b`, 'g'),
          numericValue.toString(),
        );
      }
    }

    try {
      // Safely evaluate the mathematical expression
      // Only allow basic mathematical operators for security
      if (!/^[\d\s+\-*/.()]+$/.test(processedExpression)) {
        throw new Error('Invalid mathematical expression');
      }

      // Use Function constructor for safe evaluation (limited to math operations)
      const result = new Function('return ' + processedExpression)();
      return Number(result) || 0;
    } catch (error) {
      this.logger.warn(
        `Failed to evaluate math expression: ${expression}`,
        error,
      );
      return 0;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private extractCustomerInfo(formData: Record<string, any>): {
    email: string;
    name: string;
  } {
    // Try common patterns for email and name in form data
    const email =
      formData.email ||
      formData.applicant?.email ||
      formData.contact?.email ||
      formData.customerEmail;

    const name =
      formData.fullName ||
      formData.name ||
      `${formData.firstName || formData.applicant?.firstName || ''} ${
        formData.lastName || formData.applicant?.lastName || ''
      }`.trim() ||
      `${formData.applicant?.firstName || ''} ${
        formData.applicant?.lastName || ''
      }`.trim() ||
      'Customer';

    return { email, name };
  }

  private async createPaymentRecord(data: {
    department: string;
    paymentCode: string;
    amount: number;
    description: string;
    customerEmail: string;
    customerName: string;
    formId: string;
    submissionId: string;
  }): Promise<Payment> {
    // Include department in reference number for later API key resolution
    const referenceNumber = `${data.department.toUpperCase()}-${data.formId}-${
      data.submissionId
    }`;

    const payment = this.paymentRepository.create({
      referenceNumber,
      processId: this.ezpayService.generateProcessId(),
      paymentProvider: PaymentProvider.EZPAY,
      totalAmount: data.amount,
      status: PaymentStatus.PENDING,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      paymentCode: data.paymentCode,
      description: data.description,
      metadata: {
        formId: data.formId,
        submissionId: data.submissionId,
      },
    });

    return await this.paymentRepository.save(payment);
  }

  private async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.paymentRepository.update(paymentId, {
      status,
      metadata: metadata ? { metadata } : undefined,
    });
  }

  private async updatePaymentWithToken(
    paymentId: string,
    token: string,
    paymentUrl: string,
  ): Promise<void> {
    await this.paymentRepository.update(paymentId, {
      paymentToken: token,
      paymentUrl,
      status: PaymentStatus.INITIATED,
    });
  }

  private async createFormSubmissionPayment(
    formId: string,
    submissionId: string,
    paymentId: string,
  ): Promise<void> {
    const formSubmissionPayment = this.formSubmissionPaymentRepository.create({
      formId,
      submissionId,
      paymentId,
      paymentRequired: true,
      paymentCompleted: false,
      paymentVerified: false,
      notificationSent: false,
    });

    await this.formSubmissionPaymentRepository.save(formSubmissionPayment);
  }

  /**
   * Check if a form submission has payment requirements
   */
  async hasPaymentProcessor(processors: any[]): Promise<boolean> {
    return processors.some((processor) => processor.type === 'payment');
  }

  /**
   * Get payment status for a form submission
   */
  async getPaymentStatus(
    formId: string,
    submissionId: string,
  ): Promise<{
    hasPayment: boolean;
    paymentRequired: boolean;
    paymentCompleted: boolean;
    paymentVerified: boolean;
    payment?: Payment;
  }> {
    const formSubmissionPayment =
      await this.formSubmissionPaymentRepository.findOne({
        where: { formId, submissionId },
        relations: ['payment'],
      });

    if (!formSubmissionPayment) {
      return {
        hasPayment: false,
        paymentRequired: false,
        paymentCompleted: false,
        paymentVerified: false,
      };
    }

    return {
      hasPayment: true,
      paymentRequired: formSubmissionPayment.paymentRequired,
      paymentCompleted: formSubmissionPayment.paymentCompleted,
      paymentVerified: formSubmissionPayment.paymentVerified,
      payment: formSubmissionPayment.payment,
    };
  }

  /**
   * Process response data configuration to extract additional data from form data
   */
  private async processResponseData(
    responseConfig: ResponseDataConfig,
    formData: Record<string, any>,
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    // Include specified form fields
    if (responseConfig.include) {
      for (const fieldPath of responseConfig.include) {
        const value = this.getNestedValue(formData, fieldPath);
        if (value !== undefined) {
          // Use the last part of the field path as the key (e.g., order.numberOfCopies -> numberOfCopies)
          const fieldName = fieldPath.split('.').pop() || fieldPath;
          result[fieldName] = value;
        }
      }
    }

    return result;
  }
}
