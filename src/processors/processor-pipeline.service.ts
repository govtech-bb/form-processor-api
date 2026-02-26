import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IProcessor, ProcessorContext } from './interfaces';
import { ProcessorConfig } from '../forms/interfaces';
import { SlackService } from '../common/slack.service';

@Injectable()
export class ProcessorPipelineService {
  private readonly logger = new Logger(ProcessorPipelineService.name);
  private processors: Map<string, IProcessor> = new Map();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly slackService: SlackService,
  ) {}

  registerProcessor(processor: IProcessor): void {
    this.processors.set(processor.type, processor);
    this.logger.log(`Registered processor: ${processor.type}`);
  }

  async execute(
    processorConfigs: ProcessorConfig[],
    context: ProcessorContext,
  ): Promise<Map<string, unknown>> {
    this.logger.log(
      `Executing ${processorConfigs.length} processors for form: ${context.formId}`,
    );

    const results = new Map<string, unknown>();

    // Execute all processors in parallel
    const promises = processorConfigs.map(async (config) => {
      const processor = this.processors.get(config.type);

      if (!processor) {
        this.logger.warn(`Processor not found: ${config.type}`);
        throw new BadRequestException(
          `Processor type "${config.type}" not found`,
        );
      }

      try {
        this.logger.log(`Executing processor: ${config.type}`);
        const result = await processor.execute(config.config, context);
        this.logger.log(`Processor completed: ${config.type}`);
        if (!result?.success) {
          void this.slackService.notifyError(
            this.buildErrorContext(config.type, context, result),
          );
        }
        return { type: config.type, result };
      } catch (error) {
        this.logger.error(
          `Processor ${config.type} failed: ${error.message}`,
          error.stack,
        );
        void this.slackService.notifyError(
          this.buildErrorContext(config.type, context, {
            error: error.message,
          }),
        );
        throw error;
      }
    });

    const processorResults = await Promise.all(promises);

    // Collect results by processor type
    for (const { type, result } of processorResults) {
      results.set(type, result);
    }

    this.logger.log('All processors completed successfully');
    return results;
  }

  /**
   * Execute a single processor and return its result
   */
  async executeProcessor(
    processorConfig: ProcessorConfig,
    context: ProcessorContext,
  ): Promise<any> {
    const processor = this.processors.get(processorConfig.type);

    if (!processor) {
      this.logger.warn(`Processor not found: ${processorConfig.type}`);
      throw new BadRequestException(
        `Processor type "${processorConfig.type}" not found`,
      );
    }

    try {
      this.logger.log(`Executing single processor: ${processorConfig.type}`);
      const result = await processor.execute(processorConfig.config, context);
      this.logger.log(`Processor completed: ${processorConfig.type}`);
      if (!result?.success) {
        void this.slackService.notifyError(
          this.buildErrorContext(processorConfig.type, context, result),
        );
      }
      return result;
    } catch (error) {
      this.logger.error(
        `Processor ${processorConfig.type} failed: ${error.message}`,
        error.stack,
      );
      void this.slackService.notifyError(
        this.buildErrorContext(processorConfig.type, context, {
          error: error.message,
        }),
      );
      throw error;
    }
  }

  private buildErrorContext(
    processorType: string,
    context: ProcessorContext,
    result: Record<string, any>,
  ) {
    const fields: Record<string, string | number> = {};
    if (result.amount != null) fields['Amount'] = result.amount;
    if (result.description) fields['Description'] = result.description;

    return {
      processor: processorType,
      formId: context.formId,
      submissionId: context.submissionId,
      error: result.error ?? 'Processor returned failure',
      ...(Object.keys(fields).length > 0 && { fields }),
    };
  }
}
