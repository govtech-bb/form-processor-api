/**
 * ID Generator module
 * Generates field IDs from labels when not explicitly provided
 * Handles page prefixing for multi-page forms
 * Validates ID format (camelCase: ^[a-z][a-zA-Z0-9]*$)
 */

import { toCamelCase, isValidId } from '../utils/index.js';
import type {
  FormRecipe,
  Page,
  ElementDefinition,
  Block,
  Field,
} from '../types/index.js';

/**
 * Generate IDs for all fields in a FormRecipe
 * - If meta.id is empty or missing, generate from label
 * - For multi-page forms, prepend pageId to field IDs
 * - Apply idPrefix from blocks
 */
export function generateIds(recipe: FormRecipe): FormRecipe {
  const processed: FormRecipe = {
    ...recipe,
  };

  // Single page form - no page prefix
  if (recipe.elements) {
    processed.elements = recipe.elements.map((el) =>
      processElementIds(el, '', ''),
    );
  }

  // Multi-page form - prepend pageId to field IDs
  if (recipe.pages) {
    processed.pages = recipe.pages.map((page) => processPageIds(page));
  }

  return processed;
}

/**
 * Process IDs for a page
 */
function processPageIds(page: Page): Page {
  return {
    ...page,
    elements: page.elements.map((el) => processElementIds(el, page.pageId, '')),
  };
}

/**
 * Process element IDs
 * @param element The element to process
 * @param pagePrefix Page ID prefix (empty for single page)
 * @param idPrefix Block-level ID prefix
 */
function processElementIds(
  element: ElementDefinition,
  pagePrefix: string,
  idPrefix: string,
): ElementDefinition {
  // If it's a block, process its elements and track idPrefix
  if (isBlock(element)) {
    return processBlockIds(element, pagePrefix, idPrefix);
  }

  // If it's a field, generate/process its ID
  if (isField(element)) {
    return processFieldId(element, pagePrefix, idPrefix);
  }

  // Unknown type - return as-is
  return element;
}

/**
 * Process a block's IDs
 */
function processBlockIds(
  block: Block,
  pagePrefix: string,
  parentIdPrefix: string,
): Block {
  // Get block's idPrefix if any
  const blockIdPrefix = block.meta?.idPrefix || '';
  const combinedPrefix = parentIdPrefix
    ? `${parentIdPrefix}${blockIdPrefix}`
    : blockIdPrefix;

  return {
    ...block,
    elements: block.elements.map((el) =>
      processElementIds(el, pagePrefix, combinedPrefix),
    ),
  };
}

/**
 * Process a field's ID
 */
function processFieldId(
  field: Field,
  pagePrefix: string,
  idPrefix: string,
): Field {
  const currentId = field.meta?.id;

  // Determine the ID value
  let id: string;

  if (currentId === undefined || currentId === '') {
    // Generate ID from label
    const label = field.content?.label;
    if (!label) {
      throw new Error(
        `Cannot generate ID: Field has no ID and no label\n${JSON.stringify(
          field,
          null,
          2,
        )}`,
      );
    }
    id = toCamelCase(label);
  } else {
    id = currentId;
  }

  // Apply idPrefix if present
  if (idPrefix) {
    id = `${idPrefix}${id}`;
  }

  // Validate the ID format
  if (!isValidId(id)) {
    throw new Error(
      `Invalid field ID "${id}". IDs must match pattern: ^[a-z][a-zA-Z0-9]*$ (camelCase)`,
    );
  }

  // Apply page prefix for multi-page forms
  const finalId = pagePrefix ? `${pagePrefix}.${id}` : id;

  // Return field with updated ID
  return {
    ...field,
    meta: {
      ...field.meta,
      id: finalId,
    },
  };
}

/**
 * Get the final ID for a field (with page prefix if applicable)
 * This is used when referencing fields in validation rules
 */
export function getFieldId(field: Field, pageId?: string): string {
  const id = field.meta?.id || '';
  if (pageId && id) {
    return `${pageId}.${id}`;
  }
  return id;
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
