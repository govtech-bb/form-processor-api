#!/usr/bin/env node

/**
 * CLI Interface for Recipe to Schema Builder
 */

import * as fs from 'fs';
import * as path from 'path';
import { buildFromFile } from './builder/index.js';
import {
  parseRecipeFile,
  serializeToJson,
  writeSchemaToFile,
} from './parser/index.js';

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case 'build':
      await handleBuild(args.slice(1));
      break;
    case 'build-all':
      await handleBuildAll(args.slice(1));
      break;
    case 'validate':
      await handleValidate(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

/**
 * Handle 'build' command
 */
async function handleBuild(args: string[]) {
  if (args.length === 0) {
    console.error('Usage: build <recipe-file> [options]');
    process.exit(1);
  }

  const recipePath = args[0];
  const options = parseOptions(args.slice(1));

  // Ensure recipe file exists
  if (!fs.existsSync(recipePath)) {
    console.error(`Error: Recipe file not found: ${recipePath}`);
    process.exit(1);
  }

  console.log(`Building schema from ${recipePath}...`);

  const result = await buildFromFile(recipePath, {
    registryPath: options.registry || './registry',
    outputPath: options.output,
    verbose: options.verbose,
  });

  // Print errors if any
  if (result.errors.length > 0) {
    console.error('\nErrors:');
    for (const error of result.errors) {
      console.error(`  [${error.code}] ${error.path}: ${error.message}`);
    }
  }

  // Print warnings if any
  if (result.warnings.length > 0) {
    console.warn('\nWarnings:');
    for (const warning of result.warnings) {
      console.warn(`  [${warning.code}] ${warning.path}: ${warning.message}`);
    }
  }

  // Exit on errors
  if (result.errors.length > 0) {
    process.exit(1);
  }

  // Output schema
  const schemaJson = serializeToJson(result.schema, true);

  if (!options.output) {
    const parsed = path.parse(recipePath);
    options.output = `./schemas/${parsed.name}.json`;
  }
  if (options.output) {
    // Ensure output directory exists
    const outputDir = path.dirname(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    writeSchemaToFile(result.schema, options.output);
    console.log(`\nSchema written to: ${options.output}`);
  } else {
    // Print to stdout
    console.log('\n--- Generated Schema ---');
    console.log(schemaJson);
  }

  // Print summary
  const fieldCount = Array.isArray(result.schema.fields)
    ? result.schema.fields.length
    : Object.values(result.schema.fields).flat().length;

  console.log(`\nSummary:`);
  console.log(`  Form ID: ${result.schema.formId}`);
  console.log(`  Fields: ${fieldCount}`);
  console.log(
    `  Pages: ${Array.isArray(result.schema.fields)
      ? 1
      : Object.keys(result.schema.fields).length
    }`,
  );
}

/**
 * Handle 'build-all' command
 */
async function handleBuildAll(args: string[]) {
  const options = parseOptions(args);
  const recipesDir = options.recipes || './recipes';
  const outputDir = options.output || './schemas';
  const registryPath = options.registry || './registry';

  // Ensure recipes directory exists
  if (!fs.existsSync(recipesDir)) {
    console.error(`Error: Recipes directory not found: ${recipesDir}`);
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Find all recipe files
  const recipeFiles = findRecipeFiles(recipesDir);

  if (recipeFiles.length === 0) {
    console.log(`No recipe files found in ${recipesDir}`);
    process.exit(0);
  }

  console.log(`Found ${recipeFiles.length} recipe(s) in ${recipesDir}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const recipePath of recipeFiles) {
    const recipeName = path.basename(recipePath, path.extname(recipePath));
    const outputPath = path.join(outputDir, `${recipeName}.json`);

    console.log(`Building ${recipeName}...`);

    const result = await buildFromFile(recipePath, {
      registryPath,
      verbose: options.verbose,
    });

    if (result.errors.length > 0) {
      console.error(`  ✗ Failed with ${result.errors.length} error(s)`);
      for (const error of result.errors) {
        console.error(`    [${error.code}] ${error.message}`);
      }
      errorCount++;
    } else {
      writeSchemaToFile(result.schema, outputPath);
      console.log(`  ✓ Written to ${outputPath}`);
      successCount++;
    }
  }

  console.log(`\n${successCount} succeeded, ${errorCount} failed`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

/**
 * Handle 'validate' command
 */
async function handleValidate(args: string[]) {
  if (args.length === 0) {
    console.error('Usage: validate <recipe-file>');
    process.exit(1);
  }

  const recipePath = args[0];

  if (!fs.existsSync(recipePath)) {
    console.error(`Error: Recipe file not found: ${recipePath}`);
    process.exit(1);
  }

  try {
    const recipe = parseRecipeFile(recipePath);
    console.log(`✓ Recipe is valid: ${recipe.formId}`);
    console.log(`  Title: ${recipe.title || 'N/A'}`);
    console.log(
      `  Type: ${recipe.pages
        ? `Multi-page (${recipe.pages.length} pages)`
        : 'Single page'
      }`,
    );
    process.exit(0);
  } catch (error) {
    console.error(`✗ Invalid recipe:`);
    console.error(
      `  ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    process.exit(1);
  }
}

/**
 * Parse CLI options
 */
function parseOptions(args: string[]): {
  output?: string;
  registry?: string;
  recipes?: string;
  verbose?: boolean;
} {
  const options: ReturnType<typeof parseOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '-r':
      case '--registry':
        options.registry = args[++i];
        break;
      case '--recipes':
        options.recipes = args[++i];
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
    }
  }

  return options;
}

/**
 * Find all recipe files in a directory
 */
function findRecipeFiles(dir: string): string[] {
  const files: string[] = [];

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findRecipeFiles(fullPath));
    } else if (isRecipeFile(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a file is a recipe file
 */
function isRecipeFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.yaml' || ext === '.yml' || ext === '.json';
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Recipe to Schema Builder

Usage:
  cli <command> [options]

Commands:
  build <recipe-file>     Build a single recipe into a schema
  build-all               Build all recipes in the recipes directory
  validate <recipe-file>  Validate a recipe file

Options:
  -o, --output <path>     Output file path (default: stdout)
  -r, --registry <path>   Registry directory path (default: ./registry)
  --recipes <path>        Recipes directory path (default: ./recipes)
  -v, --verbose           Enable verbose output
  -h, --help              Show this help message

Examples:
  cli build recipes/my-form.yaml -o schemas/my-form.json
  cli build-all --recipes ./recipes --output ./schemas
  cli validate recipes/my-form.yaml
`);
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
