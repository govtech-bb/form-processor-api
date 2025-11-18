import { Module } from '@nestjs/common';
import { SchemaBuilderService } from './schema-builder.service';

@Module({
  providers: [SchemaBuilderService],
  exports: [SchemaBuilderService],
})
export class ValidationModule {}
