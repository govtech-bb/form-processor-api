import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { FormsModule } from './forms/forms.module';
import { ValidationModule } from './validation/validation.module';
import { ProcessorsModule } from './processors/processors.module';
import { EmailModule } from './email/email.module';
import { FileModule } from './file/file.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    FormsModule,
    ValidationModule,
    ProcessorsModule,
    EmailModule,
    FileModule,
    MetricsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
