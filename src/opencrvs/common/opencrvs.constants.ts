import { HealthFacility } from '../types';

export const HEALTH_FACILITIES: HealthFacility[] = [
  {
    label: 'Queen Elizabeth Hospital',
    value: '3d5cd721-df37-493c-86c0-41b8aa42e27d',
  },
  {
    label: 'Bayview Hospital',
    value: '9ddfdd4a-4219-4ca0-ad34-5a9fc1071225',
  },
  {
    label: 'MD Alliance Surgery and Birthing Centre',
    value: 'a1abb507-4a25-4795-a280-c99226cb916f',
  },
];

export const OPENCRVS_FORM_MESSAGES: Record<
  string,
  { success: string; failure: string }
> = {
  'register-birth-form': {
    success: 'Birth registration submitted successfully',
    failure: 'Birth registration failed',
  },
};
