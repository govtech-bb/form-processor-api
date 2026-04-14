import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ValidationModule } from '../validation/validation.module';
import { ProcessorsModule } from '../processors/processors.module';
import { MetricsModule } from '../metrics/metrics.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { FormUtilsService } from './form-utils.service';
import { ExpressionResolverService } from './expression-resolver.service';
import { ServiceAccessService } from './service-access.service';
import { ServicesController } from './services.controller';

@Module({
  imports: [
    DatabaseModule,
    ValidationModule,
    ProcessorsModule,
    MetricsModule,
    AuthModule,
  ],
  controllers: [AuditLogController, FormsController, ServicesController],
  providers: [
    AuditLogService,
    FormsService,
    FormUtilsService,
    ExpressionResolverService,
    ServiceAccessService,
  ],
  exports: [FormsService, FormUtilsService, ExpressionResolverService],
})
export class FormsModule {}
