/**
 * Utility functions for the Recipe to Schema Builder
 */

/**
 * Convert a label string to camelCase
 * Examples:
 *   "First Name" → "firstName"
 *   "ID Number" → "idNumber"
 *   "Email Address" → "emailAddress"
 */
export function toCamelCase(label: string): string {
  if (!label || typeof label !== 'string') {
    throw new Error(`Cannot generate ID: label is empty or invalid`);
  }

  // Remove special characters except spaces, convert to lowercase
  const cleaned = label.toLowerCase().replace(/[^a-z0-9\s]/g, '');

  // Split by whitespace
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    throw new Error(`Cannot generate ID: label contains no valid characters`);
  }

  // First word lowercase, subsequent words capitalized
  return words
    .map((word, index) => {
      if (index === 0) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

/**
 * Validate that an ID satisfies the pattern: ^[a-z][a-zA-Z0-9]*$
 */
export function isValidId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[a-z][a-zA-Z0-9]*$/.test(id);
}

/**
 * Deep merge objects. Arrays are replaced, not merged.
 * Child values override parent values.
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] === undefined) {
      continue;
    }

    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      // Both are plain objects, merge recursively
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      );
    } else {
      // Array or primitive: source replaces target
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Safely get a nested value from an object using dot notation
 * Example: getNestedValue(obj, 'content.label') → obj.content.label
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set a nested value in an object using dot notation
 * Example: setNestedValue(obj, 'content.label', 'Email') → sets obj.content.label
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}

/**
 * Check if a string contains template syntax
 */
export function hasTemplate(
  str: string,
  type: 'context' | 'field' | 'processor',
): boolean {
  if (type === 'context') return str.includes('{!');
  if (type === 'field') return str.includes('{#');
  if (type === 'processor') return str.includes('{{');
  return false;
}

/**
 * Extract template variables from a string
 * Example: "{!TARGET} Address" → ["TARGET"]
 */
export function extractTemplateVars(
  str: string,
  type: 'context' | 'field' | 'processor',
): string[] {
  const patterns = {
    context: /\{!([^}]+)\}/g,
    field: /\{#([^#]+)#\}/g,
    processor: /\{\{([^}]+)\}\}/g,
  };

  const matches: string[] = [];
  const pattern = patterns[type];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(str)) !== null) {
    matches.push(match[1]);
  }

  return matches;
}

/**
 * Replace template variables in a string
 */
export function replaceTemplateVars(
  str: string,
  type: 'context' | 'field' | 'processor',
  values: Record<string, string>,
): string {
  const patterns = {
    context: /\{!([^}]+)\}/g,
    field: /\{#([^#]+)#\}/g,
    processor: /\{\{([^}]+)\}\}/g,
  };

  return str.replace(patterns[type], (match, varName) => {
    const trimmedVar = varName.trim();
    return values[trimmedVar] !== undefined ? values[trimmedVar] : match;
  });
}

/**
 * Walk through an object and apply a callback to all string values
 */
export function walkStrings(
  obj: unknown,
  callback: (str: string, path: string) => string,
  path = '',
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return callback(obj, path);
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      walkStrings(item, callback, `${path}[${index}]`),
    );
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      result[key] = walkStrings(value, callback, newPath);
    }
    return result;
  }

  return obj;
}
