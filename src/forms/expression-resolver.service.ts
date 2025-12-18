import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { FormConfig } from '../database/entities';

export interface ExpressionContext {
  formId: string;
  formData?: Record<string, any>;
  secrets?: Map<string, string>;
  configRepository?: Repository<FormConfig>;
}

@Injectable()
export class ExpressionResolverService {
  private readonly logger = new Logger(ExpressionResolverService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Resolve any expression with support for:
   * - Database secrets: {{db:form-id:key}} or {{db:key}}
   * - Form data references: {{formData.path}}
   * - Mathematical expressions: {{formData.field * db:form-id:amount}}
   * - Simple values: direct strings or numbers
   */
  async resolveExpression(
    expression: string | number,
    context: ExpressionContext,
  ): Promise<string | number> {
    // If it's not a string, return as-is
    if (typeof expression !== 'string') {
      return expression;
    }

    // If it doesn't contain expression markers, return as-is
    if (!expression.includes('{{') || !expression.includes('}}')) {
      return expression;
    }

    // Handle complex expressions (mathematical operations)
    if (this.isMathematicalExpression(expression)) {
      return await this.resolveMathematicalExpression(expression, context);
    }

    // Handle simple variable replacement
    return await this.resolveSimpleExpression(expression, context);
  }

  /**
   * Check if expression contains mathematical operators
   */
  private isMathematicalExpression(expression: string): boolean {
    // Extract content between {{ and }}
    const match = expression.match(/^\{\{(.+)\}\}$/);
    if (!match) {
      return false;
    }

    const content = match[1];
    // Look for mathematical operators with proper spacing or clear mathematical context
    // This is more specific to avoid matching hyphens in identifiers like "get-birth-certificate"
    const pattern1 = /\s+[+\-*/]\s+/.test(content); // operators with spaces on both sides
    const pattern2 = /formData\.[a-zA-Z0-9_.]+\s*[+\-*/]\s*/.test(content); // formData followed by operator
    const pattern3 = /[+\-*/]\s*formData\./.test(content); // operator followed by formData
    const pattern4 = /[+\-*/]\s*db:/.test(content); // operator followed by db reference
    const pattern5 = /\)\s*[+\-*/]\s*/.test(content); // operator after closing parenthesis
    const pattern6 = /\s*[+\-*/]\s*\(/.test(content); // operator before opening parenthesis

    const hasMathOperators =
      pattern1 || pattern2 || pattern3 || pattern4 || pattern5 || pattern6;

    return hasMathOperators;
  }

  /**
   * Resolve mathematical expressions like {{formData.numberOfCopies * db:form-id:amount}}
   */
  private async resolveMathematicalExpression(
    expression: string,
    context: ExpressionContext,
  ): Promise<number> {
    // Extract the inner expression
    const match = expression.match(/^\{\{(.+)\}\}$/);
    if (!match) {
      throw new Error(`Invalid expression format: ${expression}`);
    }

    let mathExpression = match[1];

    // Replace database references first
    mathExpression = await this.replaceDatabaseReferences(
      mathExpression,
      context,
    );

    // Replace form data references
    mathExpression = this.replaceFormDataReferences(mathExpression, context);

    // Evaluate the mathematical expression
    return this.evaluateMathExpression(mathExpression);
  }

  /**
   * Resolve simple expressions like {{db:key}} or {{formData.field}}
   */
  private async resolveSimpleExpression(
    expression: string,
    context: ExpressionContext,
  ): Promise<string> {
    // Extract the inner expression
    const match = expression.match(/^\{\{(.+)\}\}$/);
    if (!match) {
      return expression; // Return as-is if not a proper expression
    }

    let innerExpression = match[1];

    // Replace database secrets in the inner expression
    innerExpression = await this.replaceDatabaseReferences(
      innerExpression,
      context,
    );

    // Replace form data references in the inner expression
    innerExpression = this.replaceFormDataReferences(innerExpression, context);

    return innerExpression; // Return the resolved inner content without {{}}
  }

  /**
   * Replace database references in expression
   */
  private async replaceDatabaseReferences(
    expression: string,
    context: ExpressionContext,
  ): Promise<string> {
    // Match patterns like db:form-id:key or db:key
    const dbPattern = /db:([^:]+)(?::([^}\s+\-*/()]+))?/g;
    let result = expression;

    const matches = [...expression.matchAll(dbPattern)];
    for (const match of matches) {
      const [fullMatch, part1, part2] = match;
      let formId: string;
      let secretKey: string;

      if (part2) {
        // Format: db:form-id:key
        formId = part1;
        secretKey = part2;
      } else {
        // Format: db:key (use current form ID)
        formId = context.formId;
        secretKey = part1;
      }

      try {
        const secretValue = await this.getSecretValue(
          formId,
          secretKey,
          context,
        );
        result = result.replace(fullMatch, secretValue);
      } catch (error) {
        this.logger.warn(
          `Failed to resolve database reference ${fullMatch}:`,
          error.message,
        );
        // Replace with empty string or default value
        result = result.replace(fullMatch, '0');
      }
    }

    return result;
  }

  /**
   * Replace form data references in expression
   */
  private replaceFormDataReferences(
    expression: string,
    context: ExpressionContext,
  ): string {
    if (!context.formData) {
      return expression;
    }

    // Match patterns like formData.field.path
    const formDataPattern = /formData\.([a-zA-Z0-9._]+)/g;
    let result = expression;

    const matches = [...expression.matchAll(formDataPattern)];
    for (const match of matches) {
      const [fullMatch, fieldPath] = match;
      const value = this.getNestedValue(context.formData, fieldPath);

      if (value !== undefined && value !== null) {
        result = result.replace(fullMatch, String(value));
      } else {
        this.logger.warn(`Form data field not found: ${fieldPath}`);
        result = result.replace(fullMatch, '0');
      }
    }

    return result;
  }

  /**
   * Get secret value from database repository or environment variables
   */
  private async getSecretValue(
    formId: string,
    secretKey: string,
    context: ExpressionContext,
  ): Promise<string> {
    // Try database repository first if available
    if (context.configRepository) {
      try {
        const config = await context.configRepository.findOne({
          where: { formId, key: secretKey },
        });

        if (config) {
          return config.value;
        }
      } catch (error) {
        this.logger.warn(
          `Error querying database for secret ${formId}:${secretKey}:`,
          error.message,
        );
      }
    }

    // Fallback to secrets Map if provided
    if (context.secrets) {
      const secretMapKey = `${formId}:${secretKey}`;
      const value = context.secrets.get(secretMapKey);
      if (value) {
        return value;
      }
    }

    // Final fallback to environment variables
    const envKey = `${formId
      .toUpperCase()
      .replace(/-/g, '_')}_${secretKey.toUpperCase()}`;

    const value = this.configService.get<string>(envKey);
    if (value) {
      return value;
    }

    throw new Error(
      `Secret not found: ${formId}:${secretKey} (tried database, secrets map, and env ${envKey})`,
    );
  }

  /**
   * Safely evaluate mathematical expression
   */
  private evaluateMathExpression(expression: string): number {
    // Validate that expression only contains safe characters
    if (!/^[\d\s+\-*/.()]+$/.test(expression)) {
      throw new Error(`Unsafe mathematical expression: ${expression}`);
    }

    try {
      // Use Function constructor for safe evaluation
      const result = new Function('return ' + expression)();
      const numericResult = Number(result);

      if (isNaN(numericResult)) {
        throw new Error(`Invalid calculation result: ${result}`);
      }

      return numericResult;
    } catch (error) {
      this.logger.error(
        `Failed to evaluate expression ${expression}:`,
        error.message,
      );
      return 0;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  /**
   * Recursively resolve all expressions in an object
   */
  async resolveObjectExpressions(
    obj: any,
    context: ExpressionContext,
  ): Promise<any> {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return Promise.all(
        obj.map((item) => this.resolveObjectExpressions(item, context)),
      );
    }

    if (typeof obj === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = await this.resolveObjectExpressions(value, context);
      }
      return resolved;
    }

    if (typeof obj === 'string' || typeof obj === 'number') {
      return await this.resolveExpression(obj, context);
    }

    return obj;
  }
}
