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
  label: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: any;
  validations?: FieldValidation;
  options?: FieldOption[]; // For select, radio, checkbox
}

export type FieldType =
  | 'string'
  | 'email'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'textarea';

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
