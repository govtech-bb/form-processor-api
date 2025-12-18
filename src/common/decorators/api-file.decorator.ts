import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

export function ApiFile(fieldName = 'file') {
  return applyDecorators(UseInterceptors(FileInterceptor(fieldName)));
}
