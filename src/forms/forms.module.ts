import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ValidationModule } from '../validation/validation.module';
import { ProcessorsModule } from '../processors/processors.module';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { FormUtilsService } from './form-utils.service';
import { ExpressionResolverService } from './expression-resolver.service';

@Module({
  imports: [DatabaseModule, ValidationModule, ProcessorsModule],
  controllers: [FormsController],
  providers: [FormsService, FormUtilsService, ExpressionResolverService],
  exports: [FormsService, FormUtilsService, ExpressionResolverService],
})
export class FormsModule {}
