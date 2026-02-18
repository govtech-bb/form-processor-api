/**
 * Parser module for Recipe to Schema Builder
 * Handles parsing of YAML and JSON recipe files
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import type { FormRecipe, Field, Component, Block } from '../types/index.js';

/**
 * Parse a recipe file (YAML or JSON)
 */
export function parseRecipeFile(filePath: string): FormRecipe {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    return parseJsonRecipe(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    return parseYamlRecipe(content);
  } else {
    throw new Error(
      `Unsupported file format: ${ext}. Use .yaml, .yml, or .json`,
    );
  }
}

/**
 * Parse a YAML recipe string
 */
export function parseYamlRecipe(content: string): FormRecipe {
  try {
    const parsed = yaml.load(content);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('YAML content is not a valid object');
    }
    return validateFormRecipe(parsed as FormRecipe);
  } catch (error) {
    throw new Error(
      `Failed to parse YAML: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
}

/**
 * Parse a JSON recipe string
 */
export function parseJsonRecipe(content: string): FormRecipe {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('JSON content is not a valid object');
    }
    return validateFormRecipe(parsed as FormRecipe);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
}

/**
 * Parse a registry item file (Field, Component, or Block)
 */
export function parseRegistryFile<T extends Field | Component | Block>(
  filePath: string,
): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  let parsed: unknown;
  if (ext === '.json') {
    parsed = JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    parsed = yaml.load(content);
  } else {
    throw new Error(`Unsupported registry file format: ${ext}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(
      `Registry file ${filePath} does not contain a valid object`,
    );
  }

  return parsed as T;
}

/**
 * Parse a generic object file (YAML or JSON) without type validation
 * Used for processors and other non-typed registry items
 */
export function parseObjectFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  let parsed: unknown;
  if (ext === '.json') {
    parsed = JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    parsed = yaml.load(content);
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`File ${filePath} does not contain a valid object`);
  }

  return parsed as T;
}

/**
 * Parse a constants file (JSON array of label/value pairs)
 */
export function parseConstantsFile(
  filePath: string,
): Array<{ label: string; value: string }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  let parsed: unknown;
  if (ext === '.json') {
    parsed = JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    parsed = yaml.load(content);
  } else {
    throw new Error(`Unsupported constants file format: ${ext}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Constants file ${filePath} must contain an array`);
  }

  // Validate each item has label and value
  for (const item of parsed) {
    if (typeof item !== 'object' || !('label' in item) || !('value' in item)) {
      throw new Error(
        `Constants file ${filePath} contains invalid item: ${JSON.stringify(
          item,
        )}`,
      );
    }
  }

  return parsed as Array<{ label: string; value: string }>;
}

/**
 * Basic validation of FormRecipe structure
 */
function validateFormRecipe(recipe: FormRecipe): FormRecipe {
  if (!recipe.formId) {
    throw new Error('Recipe must have a formId');
  }

  if (!recipe.elements && !recipe.pages) {
    throw new Error('Recipe must have either elements or pages');
  }

  if (recipe.elements && recipe.pages) {
    throw new Error('Recipe cannot have both elements and pages');
  }

  // Validate pages have pageId
  if (recipe.pages) {
    for (const page of recipe.pages) {
      if (!page.pageId) {
        throw new Error('All pages must have a pageId');
      }
    }
  }

  return recipe;
}

/**
 * Serialize a schema to JSON
 */
export function serializeToJson(schema: unknown, pretty = true): string {
  return JSON.stringify(schema, null, pretty ? 2 : undefined);
}

/**
 * Write schema to file
 */
export function writeSchemaToFile(schema: unknown, filePath: string): void {
  const json = serializeToJson(schema, true);
  fs.writeFileSync(filePath, json, 'utf-8');
}
