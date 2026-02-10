export type MetricStatus = 'received' | 'success' | 'failed';

export interface FormSubmissionMetricData {
  formId: string;
  status: MetricStatus;
  environment: string;
  timestamp?: Date;
}
