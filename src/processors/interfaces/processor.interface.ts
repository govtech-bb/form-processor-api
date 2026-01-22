export interface ProcessorContext {
  formId: string;
  submissionId: string;
  data: Record<string, any>;
  formName?: string;
}

export interface IProcessor {
  readonly type: string;
  execute(config: Record<string, any>, context: ProcessorContext): Promise<any>;
}
