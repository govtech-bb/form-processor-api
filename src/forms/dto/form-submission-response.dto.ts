export class FormSubmissionResponseDto {
  submissionId: string;
  formId: string;
  status: 'success' | 'failed';
  processedAt: Date;

  constructor(
    submissionId: string,
    formId: string,
    status: 'success' | 'failed',
  ) {
    this.submissionId = submissionId;
    this.formId = formId;
    this.status = status;
    this.processedAt = new Date();
  }
}
