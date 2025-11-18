import { Module } from '@nestjs/common';
import { ProcessorPipelineService } from './processor-pipeline.service';
import { EmailModule } from '../email/email.module';
import { EmailProcessor } from './implementations/email.processor';

@Module({
  imports: [EmailModule],
  providers: [ProcessorPipelineService, EmailProcessor],
  exports: [ProcessorPipelineService],
})
export class ProcessorsModule {
  constructor(
    private readonly pipelineService: ProcessorPipelineService,
    private readonly emailProcessor: EmailProcessor,
  ) {
    // Register all processors
    this.pipelineService.registerProcessor(this.emailProcessor);
  }
}
