/**
 * Main Builder Orchestrator
 * Coordinates the pipeline of transformations from Recipe to Schema
 */

import { parseRecipeFile } from '../parser/index.js';
import { loadRegistry } from '../registry/index.js';
import { resolveReferences } from './resolver.js';
import { processContext } from './context-processor.js';
import { expandComponents } from './component-expander.js';
import { generateIds } from './id-generator.js';
import { processFieldTemplates } from './field-processor.js';
import { resolveOptions } from './options-resolver.js';
import { assembleSchema } from './assembler.js';
import type {
  FormRecipe,
  FormSchema,
  BuildOptions,
  BuildResult,
  Registry,
} from '../types/index.js';

// Default paths
const DEFAULT_REGISTRY_PATH = './registry';

/**
 * Build a schema from a recipe file
 */
export async function buildFromFile(
  recipePath: string,
  options: BuildOptions = {},
): Promise<BuildResult> {
  try {
    // Step 1: Parse the recipe file
    const recipe = parseRecipeFile(recipePath);

    // Build from the parsed recipe
    return buildFromRecipe(recipe, options);
  } catch (error) {
    return {
      schema: createEmptySchema('unknown'),
      errors: [
        {
          message: error instanceof Error ? error.message : 'Unknown error',
          path: recipePath,
          code: 'PARSE_ERROR',
        },
      ],
      warnings: [],
    };
  }
}

/**
 * Build a schema from a recipe object
 */
export async function buildFromRecipe(
  recipe: FormRecipe,
  options: BuildOptions = {},
): Promise<BuildResult> {
  const errors: BuildResult['errors'] = [];
  const warnings: BuildResult['warnings'] = [];

  try {
    // Step 2: Load the registry
    const registryPath = options.registryPath || DEFAULT_REGISTRY_PATH;
    const registry = loadRegistry(registryPath);

    if (options.verbose) {
      console.log(`Loaded registry from ${registryPath}`);
      console.log(`  Fields: ${registry.fields.size}`);
      console.log(`  Components: ${registry.components.size}`);
      console.log(`  Blocks: ${registry.blocks.size}`);
      console.log(`  Constants: ${registry.constants.size}`);
      console.log(`  Processors: ${registry.processors.size}`);
    }

    // Run the pipeline
    let processedRecipe = recipe;

    // Step 3: Resolve References
    if (options.verbose) console.log('Resolving references...');
    processedRecipe = resolveReferences(processedRecipe, registry);

    // Step 4: Process Context Templates
    if (options.verbose) console.log('Processing context templates...');
    processedRecipe = processContext(processedRecipe);

    // Step 5: Expand Components
    if (options.verbose) console.log('Expanding components...');
    processedRecipe = expandComponents(processedRecipe, registry);

    // Step 6: Generate IDs
    if (options.verbose) console.log('Generating IDs...');
    processedRecipe = generateIds(processedRecipe);

    // Step 7: Process Field Templates
    if (options.verbose) console.log('Processing field templates...');
    processedRecipe = processFieldTemplates(processedRecipe);

    // Step 8: Resolve Options
    if (options.verbose) console.log('Resolving options...');
    processedRecipe = resolveOptions(processedRecipe, registry);

    // Step 9: Assemble Schema
    if (options.verbose) console.log('Assembling schema...');
    const schema = assembleSchema(processedRecipe, registry);

    return {
      schema,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push({
      message: error instanceof Error ? error.message : 'Unknown error',
      path: recipe.formId || 'unknown',
      code: 'BUILD_ERROR',
    });

    return {
      schema: createEmptySchema(recipe.formId),
      errors,
      warnings,
    };
  }
}

/**
 * Build multiple recipes
 */
export async function buildMultiple(
  recipes: Array<{ path: string; recipe?: FormRecipe }>,
  options: BuildOptions = {},
): Promise<Map<string, BuildResult>> {
  const results = new Map<string, BuildResult>();

  for (const { path, recipe } of recipes) {
    if (recipe) {
      const result = await buildFromRecipe(recipe, options);
      results.set(path, result);
    } else {
      const result = await buildFromFile(path, options);
      results.set(path, result);
    }
  }

  return results;
}

/**
 * Create an empty schema (for error cases)
 */
function createEmptySchema(formId: string): FormSchema {
  return {
    formId,
    fields: [],
  };
}

/**
 * Export all builder modules for advanced usage
 */
export {
  resolveReferences,
  processContext,
  expandComponents,
  generateIds,
  processFieldTemplates,
  resolveOptions,
  assembleSchema,
};

// Re-export types
export type { FormRecipe, FormSchema, BuildOptions, BuildResult, Registry };
