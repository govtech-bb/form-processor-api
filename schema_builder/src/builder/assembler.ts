/**
 * Schema Assembler module
 * Assembles the final schema by:
 * - Moving meta properties to root level
 * - Flattening blocks and fields
 * - Organizing fields by pageId for multi-page forms
 */

import type {
  FormRecipe,
  ElementDefinition,
  Block,
  Field,
  FormSchema,
  SchemaField,
  ProcessorConfig,
} from '../types/index.js';

/**
 * Assemble the final schema from a processed recipe
 */
export function assembleSchema(recipe: FormRecipe): FormSchema {
  const schema: FormSchema = {
    formId: recipe.formId,
    title: recipe.title,
    description: recipe.description,
    fields: {},
  };

  // Process single page form (elements)
  if (recipe.elements) {
    const fields = flattenElements(recipe.elements);
    // For single page, just return the flat array
    schema.fields = fields.map(fieldToSchemaField);
  }

  // Process multi-page form (pages)
  if (recipe.pages) {
    const pageFields: Record<string, SchemaField[]> = {};

    for (const page of recipe.pages) {
      const fields = flattenElements(page.elements);
      pageFields[page.pageId] = fields.map(fieldToSchemaField);
    }

    schema.fields = pageFields;
  }

  // Copy processors and confirmation if present
  if (recipe.processors) {
    schema.processors = recipe.processors.map(processProcessor);
  }

  if (recipe.confirmation) {
    schema.confirmation = recipe.confirmation;
  }

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
 */
function fieldToSchemaField(field: Field): SchemaField {
  const { meta, ...rest } = field;

  // Build the schema field
  const schemaField: SchemaField = {
    id: meta?.id || '',
    htmlType: meta?.htmlType || '',
    ...rest,
  };

  // Copy remaining meta properties (excluding id and htmlType which are now at root)
  if (meta) {
    const { id, htmlType, ...otherMeta } = meta;
    if (Object.keys(otherMeta).length > 0) {
      schemaField.meta = otherMeta;
    }
  }

  return schemaField;
}

/**
 * Process a processor configuration
 * (Mostly passes through, but could transform refs if needed)
 */
function processProcessor(processor: ProcessorConfig): ProcessorConfig {
  return { ...processor };
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
