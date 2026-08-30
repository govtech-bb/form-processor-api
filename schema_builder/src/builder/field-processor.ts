/**
 * Field Template Processor module
 * Processes {#variable#} field template strings
 * These reference other properties on the same field object
 */

import {
  hasTemplate,
  extractTemplateVars,
  replaceTemplateVars,
  walkStrings,
  getNestedValue,
} from '../utils/index.js';
import type {
  FormRecipe,
  Page,
  ElementDefinition,
  Block,
  Field,
} from '../types/index.js';

/**
 * Process field template strings in a FormRecipe
 * Field templates reference other properties on the same object
 */
export function processFieldTemplates(recipe: FormRecipe): FormRecipe {
  const processed: FormRecipe = {
    ...recipe,
  };

  // Process elements (single page form)
  if (recipe.elements) {
    processed.elements = recipe.elements.map((el) =>
      processElementTemplates(el),
    );
  }

  // Process pages (multi-page form)
  if (recipe.pages) {
    processed.pages = recipe.pages.map((page) => processPageTemplates(page));
  }

  return processed;
}

/**
 * Process field templates in a page
 */
function processPageTemplates(page: Page): Page {
  return {
    ...page,
    elements: page.elements.map((el) => processElementTemplates(el)),
  };
}

/**
 * Process field templates in an element
 */
function processElementTemplates(
  element: ElementDefinition,
): ElementDefinition {
  // If it's a field, process its templates
  if (isField(element)) {
    return processFieldTemplateStrings(element);
  }

  // If it's a block, process its nested elements
  if (isBlock(element)) {
    return {
      ...element,
      elements: element.elements.map((el) => processElementTemplates(el)),
    };
  }

  // Unknown type - return as-is
  return element;
}

/**
 * Process field template strings in a field
 * Example: "{#content.label#} is required" → "Email Address is required"
 */
function processFieldTemplateStrings(field: Field): Field {
  // Check if field has any field templates
  if (!containsFieldTemplates(field)) {
    return field;
  }

  // Convert field to plain object for template resolution
  const fieldObj = field as unknown as Record<string, unknown>;

  // Process all string values in the field
  const processed = walkStrings(fieldObj, (str) => {
    return substituteFieldTemplates(str, fieldObj);
  });

  return processed as unknown as Field;
}

/**
 * Substitute field template variables in a string
 * Example: "{#content.label#} only accepts digits"
 */
function substituteFieldTemplates(
  str: string,
  fieldObj: Record<string, unknown>,
): string {
  if (!hasTemplate(str, 'field')) {
    return str;
  }

  // Extract all template variables
  const vars = extractTemplateVars(str, 'field');

  // Build value map from field object
  const values: Record<string, string> = {};
  for (const varPath of vars) {
    const value = getNestedValue(fieldObj, varPath);
    if (value !== undefined && value !== null) {
      values[varPath] = String(value);
    } else {
      // Template variable not found - leave as-is
      values[varPath] = `{#${varPath}#}`;
    }
  }

  // Replace all variables
  return replaceTemplateVars(str, 'field', values);
}

/**
 * Check if a field contains any field template strings
 */
function containsFieldTemplates(field: Field): boolean {
  let found = false;
  walkStrings(field as unknown as Record<string, unknown>, (str) => {
    if (hasTemplate(str, 'field')) {
      found = true;
    }
    return str;
  });
  return found;
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
