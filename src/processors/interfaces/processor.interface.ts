export interface ProcessorContext {
  formId: string;
  submissionId: string;
  data: Record<string, any>;
}

export interface IProcessor {
  readonly type: string;
  execute(
    config: Record<string, any>,
    context: ProcessorContext,
  ): Promise<void>;
}
