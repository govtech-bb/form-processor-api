import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { FormSchema } from './interfaces';
import { SchemaBuilderService } from '../validation/schema-builder.service';
import { ProcessorPipelineService } from '../processors/processor-pipeline.service';
import { FormSubmissionResponseDto } from './dto';
import { FormUtilsService } from './form-utils.service';

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    private readonly formUtilsService: FormUtilsService,
    private readonly schemaBuilderService: SchemaBuilderService,
    private readonly processorPipeline: ProcessorPipelineService,
  ) {}

  /**
   * Get all available forms
   */
  async getAllForms(): Promise<FormSchema[]> {
    return this.formUtilsService.getAllSchemas();
  }

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
    const submissionId = uuidv4();

    this.logger.log(`Processing form submission: ${formId} (${submissionId})`);

    // Get schema again with form data variables replaced for processors
    const formSchemaWithData = await this.formUtilsService.getSchemaWithSecrets(
      formId,
      data,
    );

    // Execute processor pipeline with form data injected into config
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
}
