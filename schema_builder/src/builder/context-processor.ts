/**
 * Context Processor module
 * Processes {!variable} context template strings in recipes
 * Context variables are passed down from parent to child elements
 */

import {
  hasTemplate,
  extractTemplateVars,
  replaceTemplateVars,
  walkStrings,
} from '../utils/index.js';
import type {
  FormRecipe,
  Page,
  ElementDefinition,
  Block,
  Field,
  Component,
  ContextData,
  ContentData,
} from '../types/index.js';

/**
 * Process context template strings in a FormRecipe
 * Context variables propagate from parent to child elements
 */
export function processContext(
  recipe: FormRecipe,
  parentContext: ContextData = {},
): FormRecipe {
  const processed: FormRecipe = {
    ...recipe,
  };

  // Form recipe doesn't have context property, start with parent context
  const recipeContext = { ...parentContext };

  // Process elements (single page form)
  if (recipe.elements) {
    processed.elements = recipe.elements.map((el) =>
      processElementContext(el, recipeContext),
    );
  }

  // Process pages (multi-page form)
  if (recipe.pages) {
    processed.pages = recipe.pages.map((page) =>
      processPageContext(page, recipeContext),
    );
  }

  return processed;
}

/**
 * Process context template strings in a page
 */
function processPageContext(page: Page, parentContext: ContextData): Page {
  // Merge page context with parent context
  const pageContext = { ...parentContext };

  return {
    ...page,
    elements: page.elements.map((el) => processElementContext(el, pageContext)),
  };
}

/**
 * Process context template strings in an element
 */
function processElementContext(
  element: ElementDefinition,
  parentContext: ContextData,
): ElementDefinition {
  // Merge element's own context with parent context
  const elementContext = { ...parentContext, ...element.context };

  // Check if element has any context templates
  const hasContextTemplates = containsContextTemplates(element);

  if (!hasContextTemplates && !isBlock(element)) {
    // No templates and not a block - return as-is (but with merged context)
    return {
      ...element,
      context: elementContext,
    };
  }

  // Process context templates in the element
  let processed = { ...element };

  if (hasContextTemplates) {
    processed = processElementTemplates(element, elementContext);
  }

  // Update context
  processed.context = elementContext;

  // If it's a block, process nested elements
  if (isBlock(processed)) {
    return processBlockContext(processed, elementContext);
  }

  return processed;
}

/**
 * Process context templates in a block's nested elements
 */
function processBlockContext(block: Block, parentContext: ContextData): Block {
  // Merge block context with parent context
  const blockContext = { ...parentContext, ...block.context };

  // Process context templates in block content
  let processedBlock = { ...block };

  if (block.content && containsContextTemplatesInContent(block.content)) {
    processedBlock.content = processContentTemplates(
      block.content,
      blockContext,
    );
  }

  // Process nested elements
  processedBlock.elements = block.elements.map((el) =>
    processElementContext(el, blockContext),
  );

  processedBlock.context = blockContext;

  return processedBlock;
}

/**
 * Process context template strings in a single element
 */
function processElementTemplates<T extends ElementDefinition>(
  element: T,
  context: ContextData,
): T {
  const processed = { ...element };

  // Process meta
  if (processed.meta) {
    processed.meta = walkStrings(processed.meta, (str) =>
      substituteContextTemplates(str, context),
    ) as typeof processed.meta;
  }

  // Process content
  if (processed.content) {
    processed.content = walkStrings(processed.content, (str) =>
      substituteContextTemplates(str, context),
    ) as typeof processed.content;
  }

  // Process validation
  if (processed.validation) {
    processed.validation = walkStrings(processed.validation, (str) =>
      substituteContextTemplates(str, context),
    ) as typeof processed.validation;
  }

  // Process UI
  if (processed.ui) {
    processed.ui = walkStrings(processed.ui, (str) =>
      substituteContextTemplates(str, context),
    ) as typeof processed.ui;
  }

  return processed;
}

/**
 * Substitute context template variables in a string
 * If a variable is missing, logs a warning and replaces with empty string
 */
function substituteContextTemplates(
  str: string,
  context: ContextData,
  warnings?: string[],
): string {
  if (!hasTemplate(str, 'context')) {
    return str;
  }

  // Extract all template variables
  const vars = extractTemplateVars(str, 'context');

  // Build value map, handling missing variables
  const values: Record<string, string> = {};
  for (const varName of vars) {
    if (context[varName] === undefined) {
      const warning = `Missing context variable "${varName}" in string: "${str}". Replacing with empty string.`;
      console.warn(`Warning: ${warning}`);
      if (warnings) {
        warnings.push(warning);
      }
      values[varName] = '';
    } else {
      values[varName] = context[varName];
    }
  }

  // Replace all variables
  return replaceTemplateVars(str, 'context', values);
}

/**
 * Process context templates in content data
 */
function processContentTemplates(
  content: ContentData,
  context: ContextData,
): ContentData {
  return walkStrings(content as Record<string, unknown>, (str) =>
    substituteContextTemplates(str, context),
  ) as ContentData;
}

/**
 * Check if an element contains any context template strings
 */
function containsContextTemplates(element: ElementDefinition): boolean {
  const searchObj = { ...element };
  delete (searchObj as Record<string, unknown>).context; // Don't search context itself

  let found = false;
  walkStrings(searchObj, (str) => {
    if (hasTemplate(str, 'context')) {
      found = true;
    }
    return str;
  });

  return found;
}

/**
 * Check if content contains context templates
 */
function containsContextTemplatesInContent(content: ContentData): boolean {
  let found = false;
  walkStrings(content as Record<string, unknown>, (str) => {
    if (hasTemplate(str, 'context')) {
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
    (element as Field | Component | Block).type === 'block' &&
    'elements' in element
  );
}
