/**
 * Reference Resolver module
 * Resolves ref: references to actual registry items
 * Handles nested blocks, circular reference detection, and merging overrides
 */

import { getRegistryItem } from '../registry/index.js';
import { deepMerge } from '../utils/index.js';
import type {
  Registry,
  ElementDefinition,
  ElementRef,
  Field,
  Component,
  Block,
  FormRecipe,
  Page,
  MetaData,
  ContentData,
  ValidationRules,
  UIConfig,
} from '../types/index.js';

/**
 * Context for resolution (passed through recursive calls)
 */
interface ResolutionContext {
  registry: Registry;
  refChain: Set<string>; // For circular reference detection
}

/**
 * Resolve all references in a FormRecipe
 * This transforms ElementRef items into their actual Field/Component/Block definitions
 */
export function resolveReferences(
  recipe: FormRecipe,
  registry: Registry,
): FormRecipe {
  const context: ResolutionContext = {
    registry,
    refChain: new Set(),
  };

  const resolved: FormRecipe = {
    ...recipe,
  };

  // Resolve elements (single page form)
  if (recipe.elements) {
    resolved.elements = recipe.elements.map((el) =>
      resolveElement(el, context),
    );
  }

  // Resolve pages (multi-page form)
  if (recipe.pages) {
    resolved.pages = recipe.pages.map((page) => resolvePage(page, context));
  }

  return resolved;
}

/**
 * Resolve references in a page
 */
function resolvePage(page: Page, context: ResolutionContext): Page {
  return {
    ...page,
    elements: page.elements.map((el) => resolveElement(el, context)),
  };
}

/**
 * Resolve an element definition
 * This handles ElementRef, Field, Component, and Block types
 */
function resolveElement(
  element: ElementDefinition,
  context: ResolutionContext,
): ElementDefinition {
  // If it's a reference, resolve it
  if (isElementRef(element)) {
    return resolveElementRef(element, context);
  }

  // If it's already resolved (Field, Component, or Block), process its nested elements
  if (isBlock(element)) {
    return resolveBlock(element, context);
  }

  // Field or Component with no nested elements - return as-is
  return element;
}

/**
 * Resolve an ElementRef to its actual definition
 */
function resolveElementRef(
  refElement: ElementRef,
  context: ResolutionContext,
): ElementDefinition {
  const { ref } = refElement;

  // Check for circular references
  if (context.refChain.has(ref)) {
    throw new Error(
      `Circular reference detected: ${Array.from(context.refChain).join(
        ' -> ',
      )} -> ${ref}`,
    );
  }

  // Get the referenced item from registry
  let resolved: Field | Component | Block | undefined;

  if (ref.startsWith('fields/')) {
    resolved = getRegistryItem(context.registry.fields, ref);
  } else if (ref.startsWith('components/')) {
    resolved = getRegistryItem(context.registry.components, ref);
  } else if (ref.startsWith('blocks/')) {
    resolved = getRegistryItem(context.registry.blocks, ref);
  }

  if (!resolved) {
    throw new Error(`Reference not found in registry: ${ref}`);
  }

  // Add current ref to chain for circular detection
  const newContext: ResolutionContext = {
    ...context,
    refChain: new Set(context.refChain).add(ref),
  };

  // Merge overrides from the refElement into the resolved item
  const merged = mergeOverrides(resolved, refElement);

  // If it's a block, resolve its nested elements
  if (isBlock(merged)) {
    return resolveBlock(merged, newContext);
  }

  return merged;
}

/**
 * Resolve a block's nested elements
 */
function resolveBlock(block: Block, context: ResolutionContext): Block {
  return {
    ...block,
    elements: block.elements.map((el) => resolveElement(el, context)),
  };
}

/**
 * Merge overrides from a reference into the base item
 */
function mergeOverrides<T extends Field | Component | Block>(
  base: T,
  override: ElementRef,
): T {
  const result: T = { ...base };

  if (override.meta) {
    const baseMeta = (result.meta || {}) as MetaData;
    const mergedMeta = deepMerge(
      baseMeta as Record<string, unknown>,
      override.meta as Record<string, unknown>,
    );
    result.meta = mergedMeta as T['meta'];
  }

  if (override.content) {
    const baseContent = (result.content || {}) as ContentData;
    const mergedContent = deepMerge(
      baseContent as Record<string, unknown>,
      override.content as Record<string, unknown>,
    );
    result.content = mergedContent as ContentData;
  }

  if (override.validation) {
    const baseValidation = (result.validation || {}) as ValidationRules;
    const mergedValidation = deepMerge(
      baseValidation as Record<string, unknown>,
      override.validation as Record<string, unknown>,
    );
    result.validation = mergedValidation as ValidationRules;
  }

  if (override.ui) {
    const baseUi = (result.ui || {}) as UIConfig;
    const mergedUi = deepMerge(
      baseUi as Record<string, unknown>,
      override.ui as Record<string, unknown>,
    );
    result.ui = mergedUi as UIConfig;
  }

  if (override.context) {
    result.context = { ...result.context, ...override.context };
  }

  return result;
}

/**
 * Type guards
 */
function isElementRef(element: ElementDefinition): element is ElementRef {
  return 'ref' in element && typeof (element as ElementRef).ref === 'string';
}

function isBlock(element: ElementDefinition): element is Block {
  return (
    'type' in element &&
    (element as Field | Component | Block).type === 'block' &&
    'elements' in element
  );
}
