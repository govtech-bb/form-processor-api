export interface FormSchema {
  id: string;
  name: string;
  description: string;
  fields: FormField[];
  processors: ProcessorConfig[];
}

export interface FormField {
  name: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  validations?: FieldValidation;
  options?: FieldOption[]; // For select, radio, checkbox
  fields?: FormField[]; // For nested object structures
  items?: ArrayItemSchema; // For array type - defines the structure of array items
}

export interface ArrayItemSchema {
  type: 'string' | 'number' | 'boolean' | 'object';
  properties?: Record<string, { type: string; validations?: FieldValidation }>;
  validations?: FieldValidation;
}

export type FieldType =
  | 'string'
  | 'email'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'object'
  | 'array';

export interface FieldValidation {
  min?: number; // For numbers and string length
  max?: number; // For numbers and string length
  email?: boolean;
  regex?: string;
  message?: string; // Custom error message
}

export interface FieldOption {
  label: string;
  value: string | number;
}

export interface ProcessorConfig {
  type: string;
  config: Record<string, any>;
}

export interface PaymentProcessorConfig extends ProcessorConfig {
  type: 'payment';
  config: {
    provider: 'ezpay';
    department: string; // Department name (education, health, social_services, transport, etc.)
    paymentCode: string; // EZPay+ payment code (stored in secrets)
    amount: number | string; // Fixed amount or formula like "{{formData.calculatedFee}}"
    description: string;
    allowCredit?: boolean;
    allowDebit?: boolean;
    allowPayce?: boolean;
    required?: boolean; // Whether payment is mandatory for form submission
    timing?: 'immediate' | 'after_validation'; // When to create payment
    responseData?: ResponseDataConfig; // Additional data to include in response
  };
}

export interface ResponseDataConfig {
  include?: string[]; // Form field paths to include (e.g., ['order.numberOfCopies', 'applicant.email'])
}
