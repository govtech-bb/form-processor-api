import { OPENCRVS_FORM_MESSAGES } from './opencrvs.constants';

export function getOpenCRVSSuccessMessage(formId: string): string {
  return (
    OPENCRVS_FORM_MESSAGES[formId]?.success ||
    'Registration submitted successfully'
  );
}

export function getOpenCRVSFailureMessage(formId: string): string {
  return OPENCRVS_FORM_MESSAGES[formId]?.failure || 'Registration failed';
}
