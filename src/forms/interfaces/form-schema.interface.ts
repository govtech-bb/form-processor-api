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
  required?: boolean | ConditionalRequired;
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

interface SubFieldValidation {
  min?: number;
  max?: number;
  regex?: string;
  message?: string;
}

/** Cross-field comparison vs a sibling (e.g. end year >= start year). */
export interface FieldComparisonOperator {
  condition: 'gte';
  field: string;
  message: string;
}

export interface FieldValidation {
  min?: number; // For numbers and string length
  max?: number; // For numbers and string length
  email?: boolean;
  regex?: string;
  message?: string; // Custom error message
  operator?: FieldComparisonOperator;
  condition?: {
    field: string; // Dependent field path
    operator?: 'equals' | 'not_equals' | 'in' | 'not_in'; // Default is 'equals'
    value: any[]; // Values that trigger the validation
    then: SubFieldValidation; // Validation to apply if condition is met
    else?: SubFieldValidation; // Optional validation if condition is not met
  };
}

export interface FieldOption {
  label: string;
  value: string | number;
}

export interface ConditionalRequired {
  when: ConditionalWhen;
  message?: string; // Custom error message when field is required
}

export interface ConditionalWhen {
  all?: ConditionalRule[];
  any?: ConditionalRule[];
}
export interface ConditionalRule {
  field: string; // Dependent field path (e.g., "father.idNumber")
  operator:
    | 'exists'
    | 'missing'
    | 'null'
    | 'empty'
    | 'notEmpty'
    | 'equals'
    | 'notEquals'
    | 'in'
    | 'notIn';
  value?: any; // Value for equals, notEquals, in, notIn operators
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

export interface OpenCRVSProcessorConfig extends ProcessorConfig {
  type: 'opencrvs';
  config: {
    eventType: 'birth'; // Currently only birth is supported
    officeId?: string; // Direct location ID for CRVS office
    officeName?: string; // Location name (resolved to ID at runtime)
    healthFacilityId?: string; // Direct location ID for health facility
    healthFacilityName?: string; // Location name (resolved to ID at runtime)
    parishId?: string; // Direct location ID for parish
    parishName?: string; // Location name (resolved to ID at runtime)
  };
}

export type EmailRecipientType = 'admin' | 'user';

export interface EmailProcessorConfig extends ProcessorConfig {
  type: 'email';
  config: {
    to: string | string[]; // Recipient email(s) - supports expressions like "{{formData.applicant.email}}"
    from?: string; // Optional sender email
    subject: string; // Email subject - supports expressions
    template?: string; // Handlebars template name
    html?: string; // Raw HTML content
    text?: string; // Plain text content
    recipientType?: EmailRecipientType; // 'admin' or 'user' - helps identify email purpose
  };
}
