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

@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

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
      const result = await this.formsService.submitForm(formId, data);

      if (!result.validationSuccess) {
        return ApiResponse.error(result.errors, 'Validation failed');
      }

      return ApiResponse.success(result.data, 'Form submitted successfully');
    } catch (error) {
      throw new BadRequestException(
        `Failed to process form submission: ${error.message}`,
      );
    }
  }
}
