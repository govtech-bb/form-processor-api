/**
 * Core type definitions for Recipe to Schema Builder
 */

// ============================================================================
// Template String Types
// ============================================================================

export type ContextTemplate = `{!${string}}`;
export type FieldTemplate = `{#${string}#}`;
export type ProcessorTemplate = `{{${string}}}`;
export type TemplateString =
  | ContextTemplate
  | FieldTemplate
  | ProcessorTemplate;

// ============================================================================
// Base Types
// ============================================================================

export type RecipeType = 'field' | 'component' | 'block';

export interface ValidationRules {
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  fileTypes?: string[];
  required?: boolean;
  maxSize?: string;
  skipIfHasValue?: string;
  gt?: string;
  eq?: string;
  ieq?: string;
  dependsOn?: string;
  dependsIeq?: string;
  dateIsPast?: boolean;
  dateIsPastOrToday?: boolean;
  errorMessage?: string;
}

export interface ContentData {
  label?: string;
  hint?: string;
  placeholder?: string;
  options?: string | string[] | Array<{ label: string; value: string }>;
  title?: string;
  description?: string;
  pageTitle?: string;
  pageDescription?: string;
}

export interface UIConfig {
  width?: 'short' | 'medium' | 'long';
  disabled?: boolean;
  hideLabel?: boolean;
}

export interface MetaData {
  id?: string;
  htmlType?: string;
  fieldName?: string;
  componentName?: string;
  blockName?: string;
  extends?: string;
  description?: string;
  repeatable?: boolean;
  minItems?: number;
  maxItems?: number;
  exclude?: string[];
  idPrefix?: string;
  [key: string]: unknown;
}

export interface ContextData {
  [key: string]: string;
}

// ============================================================================
// Registry Item Types (Fields, Components, Blocks)
// ============================================================================

export interface BaseRecipe {
  type: RecipeType;
  meta?: MetaData;
  content?: ContentData;
  validation?: ValidationRules;
  ui?: UIConfig;
  context?: ContextData;
}

export interface Field extends BaseRecipe {
  type: 'field';
  meta: MetaData & {
    htmlType: string;
  };
}

export interface Component extends BaseRecipe {
  type: 'component';
  meta: MetaData & {
    extends: string;
    componentName: string;
  };
}

export interface Block extends BaseRecipe {
  type: 'block';
  meta: MetaData & {
    blockName: string;
  };
  elements: ElementDefinition[];
}

// ============================================================================
// Element References (Used in recipes)
// ============================================================================

export interface ElementRef {
  ref: string; // "fields/text", "components/idNumber", "blocks/address"
  meta?: Partial<MetaData>;
  content?: Partial<ContentData>;
  validation?: Partial<ValidationRules>;
  ui?: Partial<UIConfig>;
  context?: ContextData;
}

export type ElementDefinition = ElementRef | Field | Component | Block;

// ============================================================================
// Form Recipe (Input)
// ============================================================================

export interface Page {
  pageId: string;
  pageTitle?: string;
  pageDescription?: string;
  meta?: {
    repeatable?: boolean;
    minItems?: number;
    maxItems?: number;
  };
  elements: ElementDefinition[];
}

export interface ProcessorConfig {
  type?: string;
  ref?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ConfirmationConfig {
  title?: string;
  description?: string;
  content?: string;
}

export interface FormRecipe {
  formId: string;
  title?: string;
  description?: string;
  elements?: ElementDefinition[];
  pages?: Page[];
  processors?: ProcessorConfig[];
  confirmation?: ConfirmationConfig;
}

// ============================================================================
// Output Schema Types
// ============================================================================

export interface SchemaField {
  id: string;
  htmlType: string;
  content?: ContentData;
  validation?: ValidationRules;
  ui?: UIConfig;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FormSchema {
  formId: string;
  title?: string;
  description?: string;
  fields: SchemaField[] | Record<string, SchemaField[]>;
  processors?: ProcessorConfig[];
  confirmation?: ConfirmationConfig;
}

// ============================================================================
// Registry Types
// ============================================================================

export interface Registry {
  fields: Map<string, Field>;
  components: Map<string, Component>;
  blocks: Map<string, Block>;
  constants: Map<string, Array<{ label: string; value: string }>>;
  processors: Map<string, ProcessorConfig>;
}

// ============================================================================
// Pipeline Types (for modular architecture)
// ============================================================================

export interface PipelineContext {
  recipe: FormRecipe;
  registry: Registry;
  options: BuildOptions;
}

export interface BuildOptions {
  registryPath?: string;
  outputPath?: string;
  verbose?: boolean;
}

export type PipelineStep = (
  context: PipelineContext,
) => PipelineContext | Promise<PipelineContext>;

export interface BuildResult {
  schema: FormSchema;
  errors: BuildError[];
  warnings: BuildWarning[];
}

export interface BuildError {
  message: string;
  path: string;
  code: string;
}

export interface BuildWarning {
  message: string;
  path: string;
  code: string;
}
