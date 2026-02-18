/**
 * Recipe to Schema Builder
 *
 * A modular system for building form schemas from YAML/JSON recipes.
 *
 * @example
 * ```typescript
 * import { buildFromFile, buildFromRecipe } from './index.js';
 *
 * // Build from file
 * const result = await buildFromFile('recipes/my-form.yaml');
 * console.log(result.schema);
 *
 * // Build from object
 * const result = await buildFromRecipe(recipeObject);
 * console.log(result.schema);
 * ```
 */

// Main builder exports
export {
  buildFromFile,
  buildFromRecipe,
  buildMultiple,
  resolveReferences,
  processContext,
  expandComponents,
  generateIds,
  processFieldTemplates,
  resolveOptions,
  assembleSchema,
} from './builder/index.js';

// Parser exports
export {
  parseRecipeFile,
  parseYamlRecipe,
  parseJsonRecipe,
  parseRegistryFile,
  parseConstantsFile,
  serializeToJson,
  writeSchemaToFile,
} from './parser/index.js';

// Registry exports
export {
  loadRegistry,
  getRegistryItem,
  validateRef,
} from './registry/index.js';

// Utility exports
export {
  toCamelCase,
  isValidId,
  deepMerge,
  getNestedValue,
  setNestedValue,
  hasTemplate,
  extractTemplateVars,
  replaceTemplateVars,
  walkStrings,
} from './utils/index.js';

// Type exports
export type {
  // Template types
  ContextTemplate,
  FieldTemplate,
  ProcessorTemplate,
  TemplateString,

  // Base types
  RecipeType,
  ValidationRules,
  ContentData,
  UIConfig,
  MetaData,
  ContextData,

  // Recipe types
  BaseRecipe,
  Field,
  Component,
  Block,
  ElementRef,
  ElementDefinition,
  Page,
  ProcessorConfig,
  ConfirmationConfig,
  FormRecipe,

  // Schema types
  SchemaField,
  FormSchema,

  // Registry types
  Registry,

  // Pipeline types
  PipelineContext,
  BuildOptions,
  BuildResult,
  BuildError,
  BuildWarning,
} from './types/index.js';
