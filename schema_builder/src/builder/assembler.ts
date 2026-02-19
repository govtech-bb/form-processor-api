/**
 * Schema Assembler module
 * Assembles the final schema by:
 * - Moving meta properties to root level
 * - Flattening blocks and fields
 * - Organizing fields by pageId for multi-page forms
 * - Removing recipe-only fields (context, componentName, extends, blockName, ref)
 */

import { getRegistryItem } from '../registry/index.js';
import type {
  FormRecipe,
  ElementDefinition,
  Block,
  Field,
  FormSchema,
  SchemaField,
  ProcessorConfig,
  ConfirmationConfig,
  Registry,
} from '../types/index.js';

/**
 * Assemble the final schema from a processed recipe
 */
export function assembleSchema(
  recipe: FormRecipe,
  registry: Registry,
): FormSchema {
  const schema: FormSchema = {
    formId: recipe.formId,
    id: recipe.formId, // Used for the current processor.
    title: recipe.title,
    description: recipe.description,
    fields: {},
  };

  // Process single page form (elements)
  if (recipe.elements) {
    const fields = flattenElements(recipe.elements);
    // For single page, just return the flat array
    schema.fields = fields.map((field) => fieldToSchemaField(field));
  }

  // Process multi-page form (pages)
  if (recipe.pages) {
    const pageFields: Record<string, SchemaField[]> = {};

    for (const page of recipe.pages) {
      const fields = flattenElements(page.elements);
      pageFields[page.pageId] = fields.map((field) =>
        fieldToSchemaField(field),
      );
    }

    schema.fields = pageFields;
  }

  // Resolve processors from registry if present
  if (recipe.processors) {
    schema.processors = recipe.processors.map((processor) =>
      resolveProcessor(processor, registry),
    );
  }

  // Resolve confirmation from registry and merge with recipe overrides
  schema.confirmation = resolveConfirmation(recipe.confirmation, registry);

  return schema;
}

/**
 * Flatten elements (blocks and fields) into a flat array of fields
 */
function flattenElements(elements: ElementDefinition[]): Field[] {
  const fields: Field[] = [];

  for (const element of elements) {
    if (isField(element)) {
      fields.push(element);
    } else if (isBlock(element)) {
      // Recursively flatten block elements
      fields.push(...flattenBlock(element));
    }
    // Components should have been expanded already
  }

  return fields;
}

/**
 * Flatten a block into fields
 * Respects the exclude list from meta
 */
function flattenBlock(block: Block): Field[] {
  const fields: Field[] = [];
  const excludeList = block.meta?.exclude || [];

  for (const element of block.elements) {
    if (isField(element)) {
      // Check if field should be excluded
      const fieldId = element.meta?.id;
      if (fieldId && excludeList.includes(fieldId)) {
        continue; // Skip excluded field
      }
      fields.push(element);
    } else if (isBlock(element)) {
      // Nested block - recursively flatten
      fields.push(...flattenBlock(element));
    }
  }

  return fields;
}

/**
 * Convert a Field to SchemaField format
 * - Move meta properties to root level
 * - Keep content, validation, ui at their locations
 * - Remove recipe-only fields (context, type, componentName, extends, blockName, etc.)
 */
function fieldToSchemaField(field: Field): SchemaField {
  const { meta, context: _context, type: _type, ...rest } = field;

  // Build the schema field
  const schemaField: SchemaField = {
    id: meta?.id || '',
    htmlType: meta?.htmlType || '',
  };

  // Add content if present
  if (rest.content) {
    schemaField.content = rest.content;
  }

  // Add validation if present
  if (rest.validation) {
    schemaField.validation = rest.validation;
  }

  // Add ui if present
  if (rest.ui) {
    schemaField.ui = rest.ui;
  }

  // Copy remaining meta properties (excluding recipe-only fields)
  if (meta) {
    const {
      id: _id,
      htmlType: _htmlType,
      componentName: _componentName,
      extends: _extends,
      blockName: _blockName,
      exclude: _exclude,
      idPrefix: _idPrefix,
      repeatable: _repeatable,
      minItems: _minItems,
      maxItems: _maxItems,
      description: _description,
      fieldName: _fieldName,
      ...otherMeta
    } = meta;

    if (Object.keys(otherMeta).length > 0) {
      schemaField.meta = otherMeta;
    }
  }

  return schemaField;
}

/**
 * Resolve a processor configuration
 * If it has a ref, load from registry and merge with overrides
 * Processors have type and config structure
 */
function resolveProcessor(
  processor: ProcessorConfig,
  registry: Registry,
): ProcessorConfig {
  // If it has a ref, resolve it from registry
  if (processor.ref) {
    const registryProcessor = getRegistryItem(
      registry.processors,
      processor.ref,
    );
    if (!registryProcessor) {
      throw new Error(`Processor not found in registry: ${processor.ref}`);
    }

    // Merge registry processor with overrides from recipe
    // Registry has: { type, config: {...} }
    // Recipe has: { ref, config: {...overrides...} }
    const resolved: ProcessorConfig = {
      type: registryProcessor.type,
      config: { ...registryProcessor.config },
    };

    // Apply overrides from recipe config
    if (processor.config) {
      resolved.config = {
        ...resolved.config,
        ...processor.config,
      };
    }

    return resolved;
  }

  // No ref, return processor as-is (should have type and config)
  return processor;
}

/**
 * Resolve confirmation configuration
 * Loads base confirmation from registry/processors/confirmation.yaml
 * Then merges with any overrides from the recipe
 */
function resolveConfirmation(
  recipeConfirmation: ConfirmationConfig | undefined,
  registry: Registry,
): ConfirmationConfig {
  // Load base confirmation from registry
  const baseConfirmation = getRegistryItem(registry.processors, 'confirmation');

  if (!baseConfirmation) {
    // No base confirmation in registry, return recipe confirmation or empty
    return recipeConfirmation || {};
  }

  // Start with base confirmation properties (excluding type and config)
  const {
    type: _type,
    config: _config,
    ...baseConfig
  } = baseConfirmation as Record<string, unknown>;
  const resolved: Record<string, unknown> = { ...baseConfig };

  // Merge with recipe overrides if provided
  if (recipeConfirmation) {
    Object.assign(resolved, recipeConfirmation as Record<string, unknown>);
  }

  return resolved as ConfirmationConfig;
}

/**
 * Type guard for Block
 */
function isBlock(element: ElementDefinition): element is Block {
  return (
    'type' in element &&
    (element as Field | Block).type === 'block' &&
    'elements' in element
  );
}

/**
 * Type guard for Field
 */
function isField(element: ElementDefinition): element is Field {
  return 'type' in element && (element as Field | Block).type === 'field';
}
