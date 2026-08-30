type OpenCRVSIntegrationResult = {
  success: boolean;
  message: string;
  trackingId?: string;
};

type IntegrationsResult = {
  opencrvs?: OpenCRVSIntegrationResult;
};

export class FormSubmissionResponseDto {
  submissionId: string;
  formId: string;
  status: 'success' | 'failed' | 'payment_required' | 'payment_unavailable';
  processedAt: Date;

  // Payment-related fields
  paymentRequired?: boolean;
  paymentUrl?: string;
  paymentToken?: string;
  paymentId?: string;
  referenceNumber?: string;
  amount?: number;
  description?: string;
  errorMessage?: string;

  // Integration results
  integrations?: IntegrationsResult;

  // Integration results
  integrations?: IntegrationsResult;

  // Dynamic additional data
  [key: string]: unknown;

  constructor(
    submissionId: string,
    formId: string,
    status: 'success' | 'failed' | 'payment_required' | 'payment_unavailable',
    paymentInfo?: {
      paymentRequired?: boolean;
      paymentUrl?: string;
      paymentToken?: string;
      paymentId?: string;
      referenceNumber?: string;
      amount?: number;
      description?: string;
      errorMessage?: string;
    },
    additionalData?: Record<string, unknown>,
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
      this.amount = paymentInfo.amount;
      this.description = paymentInfo.description;
      this.errorMessage = paymentInfo.errorMessage;
    }

    // Add any additional dynamic data (including integrations)
    if (additionalData) {
      Object.assign(this, additionalData);
    }
  }
}
