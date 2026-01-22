import { Injectable, Logger } from '@nestjs/common';
import { FormSchema } from './interfaces';
import { SchemaBuilderService } from '../validation/schema-builder.service';
import { ProcessorPipelineService } from '../processors/processor-pipeline.service';
import { FormSubmissionResponseDto } from './dto';
import { FormUtilsService } from './form-utils.service';
import { generateReferenceCode } from '../common/utils';

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    private readonly formUtilsService: FormUtilsService,
    private readonly schemaBuilderService: SchemaBuilderService,
    private readonly processorPipeline: ProcessorPipelineService,
  ) {}

  /**
   * Get a specific form schema
   */
  async getFormSchema(formId: string): Promise<FormSchema> {
    const formData = this.formUtilsService.getSchema(formId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { processors, ...schemaWithoutProcessors } = formData;

    return schemaWithoutProcessors as FormSchema;
  }

  /**
   * Submit form data for processing
   */
  async submitForm(
    formId: string,
    data: Record<string, any>,
  ): Promise<{
    validationSuccess: boolean;
    data?: FormSubmissionResponseDto;
    errors?: any[];
  }> {
    // Get form schema with secrets resolved (without form data for validation)
    const formSchema = await this.formUtilsService.getSchemaWithSecrets(formId);

    // Build Zod schema and validate
    const zodSchema = this.schemaBuilderService.buildZodSchema(formSchema);
    const validationResult = this.schemaBuilderService.validateData(
      zodSchema,
      data,
    );

    if (!validationResult.success) {
      return {
        validationSuccess: false,
        errors: validationResult.errors,
      };
    }

    // Generate submission ID
    const submissionId = generateReferenceCode(formId);

    this.logger.log(`Processing form submission: ${formId} (${submissionId})`);

    // Get schema again with form data variables replaced for processors
    const formSchemaWithData = await this.formUtilsService.getSchemaWithSecrets(
      formId,
      data,
    );

    // Check if form has payment processor
    const hasPayment = formSchemaWithData.processors.some(
      (processor) => processor.type === 'payment',
    );

    if (hasPayment) {
      // Handle payment-enabled form submission
      return await this.processFormWithPayment(
        formSchemaWithData,
        formId,
        submissionId,
        data,
      );
    }

    // Execute processor pipeline for non-payment forms
    await this.processorPipeline.execute(formSchemaWithData.processors, {
      formId,
      submissionId,
      data,
    });

    const response = new FormSubmissionResponseDto(
      submissionId,
      formId,
      'success',
    );

    return {
      validationSuccess: true,
      data: response,
    };
  }

  /**
   * Process form submission that requires payment
   */
  private async processFormWithPayment(
    formSchema: any,
    formId: string,
    submissionId: string,
    data: Record<string, any>,
  ): Promise<{
    validationSuccess: boolean;
    data?: FormSubmissionResponseDto;
    errors?: any[];
  }> {
    try {
      // Find payment processor config
      const paymentProcessor = formSchema.processors.find(
        (processor: any) => processor.type === 'payment',
      );

      // Separate payment and non-payment processors
      const nonPaymentProcessors = formSchema.processors.filter(
        (processor: any) => processor.type !== 'payment',
      );

      // Execute payment processor first
      const paymentResult = await this.processorPipeline.executeProcessor(
        paymentProcessor,
        {
          formId,
          submissionId,
          data,
          formName: formSchema.name,
        },
      );

      if (!paymentResult.success || !paymentResult.paymentRequired) {
        // Payment creation failed
        return {
          validationSuccess: true,
          data: new FormSubmissionResponseDto(submissionId, formId, 'failed'),
        };
      }

      // Execute non-payment processors (like sending admin notification emails)
      if (nonPaymentProcessors.length > 0) {
        await this.processorPipeline.execute(nonPaymentProcessors, {
          formId,
          submissionId,
          data: {
            ...data,
            paymentInfo: {
              paymentId: paymentResult.paymentId,
              referenceNumber: paymentResult.referenceNumber,
              amount: paymentProcessor.config.amount,
            },
          },
        });
      }

      // Return payment response
      const response = new FormSubmissionResponseDto(
        submissionId,
        formId,
        'payment_required',
        {
          paymentRequired: true,
          paymentUrl: paymentResult.paymentUrl,
          paymentToken: paymentResult.paymentToken,
          paymentId: paymentResult.paymentId,
          referenceNumber: paymentResult.referenceNumber,
          amount: paymentProcessor.config.amount,
          description: paymentProcessor.config.description,
        },
        paymentResult.additionalData,
      );

      return {
        validationSuccess: true,
        data: response,
      };
    } catch (error) {
      console.log(error);
      this.logger.error(
        `Payment processing failed for ${formId}:${submissionId}`,
        error,
      );

      return {
        validationSuccess: true,
        data: new FormSubmissionResponseDto(submissionId, formId, 'failed'),
      };
    }
  }
}
