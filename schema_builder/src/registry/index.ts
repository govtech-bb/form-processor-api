/**
 * Registry Loader module
 * Loads fields, components, blocks, and constants from the registry directory
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  parseRegistryFile,
  parseConstantsFile,
  parseObjectFile,
} from '../parser/index.js';
import type {
  Registry,
  Field,
  Component,
  Block,
  ProcessorConfig,
} from '../types/index.js';

const REGISTRY_SUBDIRS = {
  fields: 'fields',
  components: 'components',
  blocks: 'blocks',
  constants: 'constants',
  processors: 'processors',
};

/**
 * Load the entire registry from the registry directory
 */
export function loadRegistry(registryPath: string): Registry {
  const registry: Registry = {
    fields: new Map(),
    components: new Map(),
    blocks: new Map(),
    constants: new Map(),
    processors: new Map(),
  };

  // Load fields
  const fieldsPath = path.join(registryPath, REGISTRY_SUBDIRS.fields);
  if (fs.existsSync(fieldsPath)) {
    loadRegistryItems(fieldsPath, registry.fields, 'field');
  }

  // Load components
  const componentsPath = path.join(registryPath, REGISTRY_SUBDIRS.components);
  if (fs.existsSync(componentsPath)) {
    loadRegistryItems(componentsPath, registry.components, 'component');
  }

  // Load blocks
  const blocksPath = path.join(registryPath, REGISTRY_SUBDIRS.blocks);
  if (fs.existsSync(blocksPath)) {
    loadRegistryItems(blocksPath, registry.blocks, 'block');
  }

  // Load constants
  const constantsPath = path.join(registryPath, REGISTRY_SUBDIRS.constants);
  if (fs.existsSync(constantsPath)) {
    loadConstants(constantsPath, registry.constants);
  }

  // Load processors
  const processorsPath = path.join(registryPath, REGISTRY_SUBDIRS.processors);
  if (fs.existsSync(processorsPath)) {
    loadProcessors(processorsPath, registry.processors);
  }

  return registry;
}

/**
 * Load registry items (fields, components, or blocks) from a directory
 */
function loadRegistryItems<T extends Field | Component | Block>(
  dirPath: string,
  registryMap: Map<string, T>,
  expectedType: string,
): void {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Recursively load subdirectories
      loadRegistryItems(filePath, registryMap, expectedType);
    } else if (isYamlOrJson(file)) {
      try {
        const item = parseRegistryFile<T>(filePath);

        // Validate type
        if (item.type !== expectedType) {
          console.warn(
            `Warning: ${filePath} has type "${item.type}" but expected "${expectedType}"`,
          );
          continue;
        }

        // Get the name from filename (without extension)
        const name = path.basename(file, path.extname(file));

        // Get the relative path from the registry type directory
        // This will be used as the reference key
        const relativeDir = path.relative(
          path.dirname(dirPath),
          path.dirname(filePath),
        );
        const refKey = relativeDir
          ? `${path.basename(dirPath)}/${relativeDir}/${name}`
          : `${path.basename(dirPath)}/${name}`;

        // Also store with simpler key for convenience
        const simpleKey = name;

        // Store in registry
        registryMap.set(refKey, item);
        registryMap.set(simpleKey, item);
      } catch (error) {
        console.error(`Error loading registry file ${filePath}:`, error);
      }
    }
  }
}

/**
 * Load constants from the constants directory
 */
function loadConstants(
  dirPath: string,
  constantsMap: Map<string, Array<{ label: string; value: string }>>,
): void {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      loadConstants(filePath, constantsMap);
    } else if (isYamlOrJson(file)) {
      try {
        const constants = parseConstantsFile(filePath);
        const name = path.basename(file, path.extname(file));
        constantsMap.set(name, constants);
      } catch (error) {
        console.error(`Error loading constants file ${filePath}:`, error);
      }
    }
  }
}

/**
 * Check if file is YAML or JSON
 */
function isYamlOrJson(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.yaml' || ext === '.yml' || ext === '.json';
}

/**
 * Get a registry item by reference string
 * Reference format: "fields/text", "components/idNumber", "blocks/address"
 */
export function getRegistryItem<T>(
  registry: Map<string, T>,
  ref: string,
): T | undefined {
  // Try exact match first
  if (registry.has(ref)) {
    return registry.get(ref);
  }

  // Try without prefix (e.g., "text" instead of "fields/text")
  const parts = ref.split('/');
  const name = parts[parts.length - 1];

  return registry.get(name);
}

/**
 * Load processors from the processors directory
 */
function loadProcessors(
  dirPath: string,
  processorsMap: Map<string, ProcessorConfig>,
): void {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      loadProcessors(filePath, processorsMap);
    } else if (isYamlOrJson(file)) {
      try {
        const processor = parseObjectFile<ProcessorConfig>(filePath);
        const name = path.basename(file, path.extname(file));

        // Store with both full path and simple name
        const refKey = `processors/${name}`;
        processorsMap.set(refKey, processor);
        processorsMap.set(name, processor);
      } catch (error) {
        console.error(`Error loading processor file ${filePath}:`, error);
      }
    }
  }
}

/**
 * Validate that a reference exists in the registry
 */
export function validateRef(
  ref: string,
  registry: Registry,
): { valid: boolean; type?: 'field' | 'component' | 'block' | 'processor' } {
  if (ref.startsWith('fields/')) {
    return {
      valid: getRegistryItem(registry.fields, ref) !== undefined,
      type: 'field',
    };
  }
  if (ref.startsWith('components/')) {
    return {
      valid: getRegistryItem(registry.components, ref) !== undefined,
      type: 'component',
    };
  }
  if (ref.startsWith('blocks/')) {
    return {
      valid: getRegistryItem(registry.blocks, ref) !== undefined,
      type: 'block',
    };
  }
  if (ref.startsWith('processors/')) {
    return {
      valid: getRegistryItem(registry.processors, ref) !== undefined,
      type: 'processor',
    };
  }

  return { valid: false };
}
