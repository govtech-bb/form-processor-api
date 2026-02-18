/**
 * Options Resolver module
 * Resolves options for select/radio fields:
 * - Loads options from constants/ files
 * - Converts string arrays to label/value pairs
 */

import type {
  Registry,
  FormRecipe,
  Page,
  ElementDefinition,
  Block,
  Field,
} from '../types/index.js';

/**
 * Resolve options for all fields in a FormRecipe
 */
export function resolveOptions(
  recipe: FormRecipe,
  registry: Registry,
): FormRecipe {
  const processed: FormRecipe = {
    ...recipe,
  };

  // Process elements (single page form)
  if (recipe.elements) {
    processed.elements = recipe.elements.map((el) =>
      processElementOptions(el, registry),
    );
  }

  // Process pages (multi-page form)
  if (recipe.pages) {
    processed.pages = recipe.pages.map((page) =>
      processPageOptions(page, registry),
    );
  }

  return processed;
}

/**
 * Process options for a page
 */
function processPageOptions(page: Page, registry: Registry): Page {
  return {
    ...page,
    elements: page.elements.map((el) => processElementOptions(el, registry)),
  };
}

/**
 * Process options for an element
 */
function processElementOptions(
  element: ElementDefinition,
  registry: Registry,
): ElementDefinition {
  // If it's a field, resolve its options
  if (isField(element)) {
    return processFieldOptions(element, registry);
  }

  // If it's a block, process its nested elements
  if (isBlock(element)) {
    return {
      ...element,
      elements: element.elements.map((el) =>
        processElementOptions(el, registry),
      ),
    };
  }

  // Unknown type - return as-is
  return element;
}

/**
 * Process options for a field
 */
function processFieldOptions(field: Field, registry: Registry): Field {
  const options = field.content?.options;

  // No options to process
  if (options === undefined) {
    return field;
  }

  let resolvedOptions: Array<{ label: string; value: string }>;

  if (typeof options === 'string') {
    // Load from constants file
    // Format: "constants/titles" or just "titles"
    const constantName = options.replace(/^constants\//, '');
    const constants = registry.constants.get(constantName);

    if (!constants) {
      throw new Error(
        `Constants not found: ${options} (referenced in field "${
          field.meta.id || 'unknown'
        }")`,
      );
    }

    resolvedOptions = constants;
  } else if (Array.isArray(options)) {
    if (options.length === 0) {
      resolvedOptions = [];
    } else if (typeof options[0] === 'string') {
      // Array of strings - convert to label/value pairs
      resolvedOptions = (options as string[]).map((str) => ({
        label: str,
        value: stringToValue(str),
      }));
    } else {
      // Already an array of objects - use as-is
      resolvedOptions = options as Array<{ label: string; value: string }>;
    }
  } else {
    // Unknown format - return as-is
    return field;
  }

  // Return field with resolved options
  return {
    ...field,
    content: {
      ...field.content,
      options: resolvedOptions,
    },
  };
}

/**
 * Convert a string label to a value
 * Rules:
 * - Lowercase
 * - Remove all non-alphanumeric characters except spaces
 * - Replace spaces with hyphens
 *
 * Example: "Mr. & Mrs." → "mr-mrs"
 */
export function stringToValue(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars except spaces
    .trim()
    .replace(/\s+/g, '-'); // Replace spaces with hyphens
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
