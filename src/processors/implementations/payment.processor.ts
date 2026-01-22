import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      formName?: string;
    },
  ): Promise<any> {
    const result = await this.process(context.data, config, context);
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
      formName?: string;
    },
  ): Promise<PaymentProcessorResult> {
    try {
      this.logger.log(`Processing payment for form ${context.formId}`, {
        submissionId: context.submissionId,
        formId: context.formId,
      });

      // Resolve configuration values
      const resolvedConfig = await this.resolveConfig(config);

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
        confirmationEmailTo: config.confirmationEmailTo,
        configCustomerEmail: config.customerEmail,
        formName: context.formName,
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
    // At this point, all expressions should already be resolved by FormUtilsService
    const paymentCode = config.paymentCode;
    const amount = Number(config.amount) || 0;

    // Get the department and corresponding API key
    const department = config.department || 'default';
    const apiKey =
      this.departmentMappingService.getApiKeyForDepartment(department);

    this.logger.log(`Resolved payment config:`, {
      department,
      paymentCode,
      amount,
      description: config.description,
    });

    return {
      department,
      paymentCode,
      amount,
      description: config.description,
      allowCredit: config.allowCredit ?? true,
      allowDebit: config.allowDebit ?? true,
      allowPayce: config.allowPayce ?? true,
      apiKey,
    };
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
    confirmationEmailTo?: string[];
    configCustomerEmail?: string;
    formName?: string;
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
        confirmationEmailTo: data.confirmationEmailTo,
        configCustomerEmail: data.configCustomerEmail,
        formName: data.formName,
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
