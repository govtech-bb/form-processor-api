export class FormSubmissionResponseDto {
  submissionId: string;
  formId: string;
  status: 'success' | 'failed' | 'payment_required';
  processedAt: Date;

  // Payment-related fields
  paymentRequired?: boolean;
  paymentUrl?: string;
  paymentToken?: string;
  paymentId?: string;
  referenceNumber?: string;

  constructor(
    submissionId: string,
    formId: string,
    status: 'success' | 'failed' | 'payment_required',
    paymentInfo?: {
      paymentRequired?: boolean;
      paymentUrl?: string;
      paymentToken?: string;
      paymentId?: string;
      referenceNumber?: string;
    },
  ) {
    this.submissionId = submissionId;
    this.formId = formId;
    this.status = status;
    this.processedAt = new Date();

    if (paymentInfo) {
      this.paymentRequired = paymentInfo.paymentRequired;
      this.paymentUrl = paymentInfo.paymentUrl;
      this.paymentToken = paymentInfo.paymentToken;
      this.paymentId = paymentInfo.paymentId;
      this.referenceNumber = paymentInfo.referenceNumber;
    }
  }
}
