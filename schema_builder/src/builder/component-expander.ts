/**
 * Component Expander module
 * Expands components that use "extends:" into their final Field form
 * Merges component properties with the base field properties
 */

import { getRegistryItem } from '../registry/index.js';
import { deepMerge } from '../utils/index.js';
import type {
  Registry,
  FormRecipe,
  Page,
  ElementDefinition,
  Block,
  Field,
  Component,
  MetaData,
  ContentData,
  ValidationRules,
  UIConfig,
} from '../types/index.js';

/**
 * Expand all components in a FormRecipe into their Field form
 */
export function expandComponents(
  recipe: FormRecipe,
  registry: Registry,
): FormRecipe {
  const processed: FormRecipe = {
    ...recipe,
  };

  // Process elements (single page form)
  if (recipe.elements) {
    processed.elements = recipe.elements.map((el) =>
      expandElement(el, registry),
    );
  }

  // Process pages (multi-page form)
  if (recipe.pages) {
    processed.pages = recipe.pages.map((page) => expandPage(page, registry));
  }

  return processed;
}

/**
 * Expand components in a page
 */
function expandPage(page: Page, registry: Registry): Page {
  return {
    ...page,
    elements: page.elements.map((el) => expandElement(el, registry)),
  };
}

/**
 * Expand an element definition
 * Components get expanded to Fields, Blocks and Fields pass through
 */
function expandElement(
  element: ElementDefinition,
  registry: Registry,
): ElementDefinition {
  // If it's a component, expand it to a field
  if (isComponent(element)) {
    return expandComponent(element, registry);
  }

  // If it's a block, expand its nested elements
  if (isBlock(element)) {
    return expandBlock(element, registry);
  }

  // It's already a field - return as-is
  return element;
}

/**
 * Expand a component to a field by merging with its base field
 */
function expandComponent(component: Component, registry: Registry): Field {
  const { extends: baseRef } = component.meta;

  // Get the base field from registry
  const baseField = getRegistryItem(registry.fields, baseRef);

  if (!baseField) {
    throw new Error(
      `Component "${component.meta.componentName}" extends unknown field: ${baseRef}`,
    );
  }

  // Merge component properties into base field
  // Component properties override base field properties
  const mergedMeta = mergeMeta(baseField.meta, component.meta);

  // Ensure htmlType is set (from base field)
  if (!mergedMeta.htmlType) {
    mergedMeta.htmlType = baseField.meta.htmlType;
  }

  const merged: Field = {
    type: 'field',
    meta: mergedMeta as MetaData & { htmlType: string },
  };

  if (baseField.content || component.content) {
    merged.content = mergeContent(baseField.content, component.content);
  }

  if (baseField.validation || component.validation) {
    merged.validation = mergeValidation(
      baseField.validation,
      component.validation,
    );
  }

  if (baseField.ui || component.ui) {
    merged.ui = mergeUi(baseField.ui, component.ui);
  }

  if (baseField.context || component.context) {
    merged.context = { ...baseField.context, ...component.context };
  }

  return merged;
}

/**
 * Expand a block's nested elements
 */
function expandBlock(block: Block, registry: Registry): Block {
  return {
    ...block,
    elements: block.elements.map((el) => expandElement(el, registry)),
  };
}

/**
 * Merge meta data (component overrides base field)
 */
function mergeMeta(
  base: MetaData | undefined,
  override: MetaData | undefined,
): MetaData {
  const baseMeta = base || {};
  const overrideMeta = override || {};

  const merged = deepMerge(
    baseMeta as Record<string, unknown>,
    overrideMeta as Record<string, unknown>,
  );

  // Ensure htmlType is preserved from base field if not overridden
  if (base?.htmlType && !override?.htmlType) {
    merged.htmlType = base.htmlType;
  }

  return merged as MetaData;
}

/**
 * Merge content data (component overrides base field)
 */
function mergeContent(
  base: ContentData | undefined,
  override: ContentData | undefined,
): ContentData {
  const baseContent = base || {};
  const overrideContent = override || {};

  return deepMerge(
    baseContent as Record<string, unknown>,
    overrideContent as Record<string, unknown>,
  ) as ContentData;
}

/**
 * Merge validation rules (component overrides base field)
 */
function mergeValidation(
  base: ValidationRules | undefined,
  override: ValidationRules | undefined,
): ValidationRules {
  const baseValidation = base || {};
  const overrideValidation = override || {};

  return deepMerge(
    baseValidation as Record<string, unknown>,
    overrideValidation as Record<string, unknown>,
  ) as ValidationRules;
}

/**
 * Merge UI config (component overrides base field)
 */
function mergeUi(
  base: UIConfig | undefined,
  override: UIConfig | undefined,
): UIConfig {
  const baseUi = base || {};
  const overrideUi = override || {};

  return deepMerge(
    baseUi as Record<string, unknown>,
    overrideUi as Record<string, unknown>,
  ) as UIConfig;
}

/**
 * Type guard for Component
 */
function isComponent(element: ElementDefinition): element is Component {
  return (
    'type' in element &&
    (element as Field | Component | Block).type === 'component'
  );
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
