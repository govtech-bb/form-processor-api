import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FormsService } from './forms.service';
import { ApiResponse } from '../common/dto';
import { CloudWatchMetricsService } from '../metrics/cloudwatch-metrics.service';

@Controller('forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly metricsService: CloudWatchMetricsService,
  ) {}

  @Get(':formId')
  @HttpCode(HttpStatus.OK)
  async getFormSchema(@Param('formId') formId: string) {
    const schema = await this.formsService.getFormSchema(formId);
    return ApiResponse.success(schema, 'Form schema retrieved successfully');
  }

  @Post(':formId/submit')
  @HttpCode(HttpStatus.OK)
  async submitForm(
    @Param('formId') formId: string,
    @Body() data: Record<string, any>,
  ) {
    try {
      // Emit 'received' metric for all form submissions
      await this.metricsService.emitFormSubmissionMetric(formId, 'received');

      const result = await this.formsService.submitForm(formId, data);

      if (!result.validationSuccess) {
        // Emit 'failed' metric for validation failures
        await this.metricsService.emitFormSubmissionMetric(formId, 'failed');
        return ApiResponse.error(result.errors, 'Validation failed');
      }

      return ApiResponse.success(result.data, 'Form submitted successfully');
    } catch (error) {
      // Emit 'failed' metric for processing errors
      await this.metricsService.emitFormSubmissionMetric(formId, 'failed');
      throw new BadRequestException(
        `Failed to process form submission: ${error.message}`,
      );
    }
  }
}
