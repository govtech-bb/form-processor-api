import { Injectable, BadRequestException } from '@nestjs/common';
import { z, ZodSchema, ZodError } from 'zod';
import {
  FormSchema,
  FormField,
  FieldValidation,
  ConditionalRule,
  ConditionalWhen,
  ConditionalRequired,
} from '../forms/interfaces';

@Injectable()
export class SchemaBuilderService {
  buildZodSchema(formSchema: FormSchema): ZodSchema {
    const shape: Record<string, any> = {};

    for (const field of formSchema.fields) {
      shape[field.name] = this.buildFieldSchema(field);
    }

    const { dynamicallyRequired, dynamicallyValidated } =
      this.collectConditionalFields(formSchema.fields);
    const gteObjectRules = this.collectGteFieldRules(formSchema.fields);
    const gteArrayRules = this.collectGteFieldRulesFromArrays(
      formSchema.fields,
    );

    return z.object(shape).superRefine((data, ctx) => {
      /* -----------------------------
       * CONDITIONAL REQUIRED
       * ----------------------------- */
      for (const { field, path } of dynamicallyRequired) {
        const requiredCondition = field.required as ConditionalRequired;
        const currentValue = this.getValueByPath(data, path.join('.'));

        // Skip validation if parent object doesn't exist
        if (!this.shouldValidateConditional(data, path)) continue;

        const conditionMet = this.evaluateWhen(requiredCondition.when, data);

        if (conditionMet && this.isEmpty(currentValue)) {
          ctx.addIssue({
            path,
            message: requiredCondition.message || `${field.name} is required`,
            code: 'custom',
          });
        }
      }

      /* -----------------------------
       * CONDITIONAL VALIDATIONS
       * ----------------------------- */
      for (const { field, path } of dynamicallyValidated) {
        const validationCondition = field.validations.condition as any;

        const dependentValue = this.getValueByPath(
          data,
          validationCondition.field,
        );
        const currentValue = this.getValueByPath(data, path.join('.'));

        // Handle then/else validations
        if (field.validations?.condition) {
          const cond = field.validations.condition;
          const opResult = this.evaluateCondition(
            dependentValue,
            cond.operator,
            cond.value,
          );

          const validationsToApply = opResult ? cond.then : cond.else;
          if (validationsToApply) {
            this.runConditionalRules(
              validationsToApply,
              field.type,
              currentValue,
              ctx,
              path,
            );
          }
        }
      }

      for (const { endPath, startPath, message } of gteObjectRules) {
        this.applyGteFieldRule(data, ctx, endPath, startPath, message);
      }

      for (const rule of gteArrayRules) {
        this.applyGteFieldRuleForArrayItems(data, ctx, rule);
      }
    });
  }

  private isOptionalField(field: FormField): boolean {
    return !field.required || typeof field.required === 'object';
  }

  private isEmpty(value: any): boolean {
    return value === undefined || value === null || value === '';
  }

  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  private getValueByPathSegments(obj: any, segments: (string | number)[]): any {
    return segments.reduce(
      (acc, key) => (acc == null ? acc : acc[key as keyof typeof acc]),
      obj,
    );
  }

  private collectGteFieldRules(
    fields: FormField[],
    pathPrefix: string[] = [],
  ): { endPath: string[]; startPath: string[]; message: string }[] {
    const rules: {
      endPath: string[];
      startPath: string[];
      message: string;
    }[] = [];

    for (const field of fields) {
      const currentPath = [...pathPrefix, field.name];

      if (field.type === 'object' && field.fields) {
        rules.push(...this.collectGteFieldRules(field.fields, currentPath));
      }

      if (field.validations?.gteField) {
        const startPath = [...pathPrefix, field.validations.gteField];
        rules.push({
          endPath: currentPath,
          startPath,
          message:
            field.validations.gteMessage ??
            'End year must be the same as or after start year',
        });
      }
    }

    return rules;
  }

  private collectGteFieldRulesFromArrays(
    fields: FormField[],
    pathPrefix: string[] = [],
  ): {
    arrayPath: string[];
    endKey: string;
    startKey: string;
    message: string;
  }[] {
    const rules: {
      arrayPath: string[];
      endKey: string;
      startKey: string;
      message: string;
    }[] = [];

    for (const field of fields) {
      const currentPath = [...pathPrefix, field.name];

      if (field.type === 'object' && field.fields) {
        rules.push(
          ...this.collectGteFieldRulesFromArrays(field.fields, currentPath),
        );
      }

      if (
        field.type === 'array' &&
        field.items?.type === 'object' &&
        field.items.properties
      ) {
        for (const [propName, propDef] of Object.entries(
          field.items.properties,
        )) {
          if (propDef.validations?.gteField) {
            rules.push({
              arrayPath: currentPath,
              endKey: propName,
              startKey: propDef.validations.gteField,
              message:
                propDef.validations.gteMessage ??
                'End year must be the same as or after start year',
            });
          }
        }
      }
    }

    return rules;
  }

  private applyGteFieldRule(
    data: unknown,
    ctx: z.RefinementCtx,
    endPath: string[],
    startPath: string[],
    message: string,
  ): void {
    const startVal = this.getValueByPathSegments(data, startPath);
    const endVal = this.getValueByPathSegments(data, endPath);

    if (typeof startVal !== 'string' || typeof endVal !== 'string') {
      return;
    }

    if (!startVal.trim() || !endVal.trim()) {
      return;
    }

    const start = Number.parseInt(startVal, 10);
    const end = Number.parseInt(endVal, 10);

    if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
      ctx.addIssue({
        path: endPath,
        message,
        code: 'custom',
      });
    }
  }

  private applyGteFieldRuleForArrayItems(
    data: unknown,
    ctx: z.RefinementCtx,
    rule: {
      arrayPath: string[];
      endKey: string;
      startKey: string;
      message: string;
    },
  ): void {
    const arr = this.getValueByPathSegments(data, rule.arrayPath);
    if (!Array.isArray(arr)) {
      return;
    }

    for (let index = 0; index < arr.length; index++) {
      const item = arr[index];
      if (!item || typeof item !== 'object') {
        continue;
      }
      const rec = item as Record<string, unknown>;
      const startVal = rec[rule.startKey];
      const endVal = rec[rule.endKey];

      if (typeof startVal !== 'string' || typeof endVal !== 'string') {
        continue;
      }

      if (!startVal.trim() || !endVal.trim()) {
        continue;
      }

      const start = Number.parseInt(startVal, 10);
      const end = Number.parseInt(endVal, 10);

      if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
        ctx.addIssue({
          path: [...rule.arrayPath, index, rule.endKey],
          message: rule.message,
          code: 'custom',
        });
      }
    }
  }

  private evaluateRule(
    rule: ConditionalRule,
    data: Record<string, unknown>,
  ): boolean {
    const value = this.getValueByPath(data, rule.field);

    switch (rule.operator) {
      case 'exists':
        return value !== undefined;

      case 'missing':
        return value === undefined;

      case 'null':
        return value === null;

      case 'empty':
        return this.isEmpty(value);

      case 'notEmpty':
        return !this.isEmpty(value);

      case 'equals':
        return value === rule.value;

      case 'notEquals':
        return value !== rule.value;

      case 'in':
        return Array.isArray(rule.value) && rule.value.includes(value);

      case 'notIn':
        return !Array.isArray(rule.value) || !rule.value.includes(value);

      default:
        return false;
    }
  }

  private evaluateWhen(
    when: ConditionalWhen,
    data: Record<string, unknown>,
  ): boolean {
    if (when.all && Array.isArray(when.all)) {
      return when.all.every((rule) => this.evaluateRule(rule, data));
    }

    if (when.any && Array.isArray(when.any)) {
      return when.any.some((rule) => this.evaluateRule(rule, data));
    }

    return false;
  }

  private collectConditionalFields(
    fields: FormField[],
    path: string[] = [],
  ): {
    dynamicallyRequired: { field: FormField; path: string[] }[];
    dynamicallyValidated: { field: FormField; path: string[] }[];
  } {
    const dynamicallyRequired: { field: FormField; path: string[] }[] = [];
    const dynamicallyValidated: { field: FormField; path: string[] }[] = [];

    for (const field of fields) {
      const currentPath = [...path, field.name];

      if (typeof field.required === 'object') {
        dynamicallyRequired.push({ field, path: currentPath });
      }

      if (field.validations?.condition) {
        dynamicallyValidated.push({ field, path: currentPath });
      }

      if (field.type === 'object' && field.fields) {
        const nested = this.collectConditionalFields(field.fields, currentPath);
        dynamicallyRequired.push(...nested.dynamicallyRequired);
        dynamicallyValidated.push(...nested.dynamicallyValidated);
      }
    }

    return { dynamicallyRequired, dynamicallyValidated };
  }

  private shouldValidateConditional(
    data: any,
    path: (string | number)[],
  ): boolean {
    if (path.length <= 1) return true;

    const parentPath = path.slice(0, -1).join('.');
    const parentValue = this.getValueByPath(data, parentPath);

    return parentValue !== undefined && parentValue !== null;
  }

  private evaluateCondition(
    value: any,
    operator: string,
    compareValue: any,
  ): boolean {
    switch (operator) {
      case 'in':
        return (compareValue as any[]).includes(value);
      case 'notIn':
        return !(compareValue as any[]).includes(value);
      case 'equals':
        return value === compareValue;
      case 'notEquals':
        return value !== compareValue;
      default:
        return false;
    }
  }

  private runConditionalRules(
    validations: FieldValidation | undefined,
    type: string,
    value: any,
    ctx: z.RefinementCtx,
    path: (string | number)[],
  ) {
    if (!validations || this.isEmpty(value)) return;

    // Regex
    if (validations.regex) {
      try {
        const regex = new RegExp(validations.regex);
        if (!regex.test(value)) {
          ctx.addIssue({
            path,
            code: 'custom',
            message: validations.message || 'Invalid format',
          });
        }
      } catch {
        throw new BadRequestException(
          `Invalid regex pattern: ${validations.regex}`,
        );
      }
    }

    // String min/max
    if (type === 'string') {
      if (validations.min !== undefined && value?.length < validations.min) {
        ctx.addIssue({
          path,
          code: 'custom',
          message:
            validations.message || `Minimum length is ${validations.min}`,
        });
      }

      if (validations.max !== undefined && value?.length > validations.max) {
        ctx.addIssue({
          path,
          code: 'custom',
          message:
            validations.message || `Maximum length is ${validations.max}`,
        });
      }
    }

    // Number min/max
    if (type === 'number') {
      if (validations.min !== undefined && value < validations.min) {
        ctx.addIssue({
          path,
          code: 'custom',
          message: validations.message || `Minimum value is ${validations.min}`,
        });
      }

      if (validations.max !== undefined && value > validations.max) {
        ctx.addIssue({
          path,
          code: 'custom',
          message: validations.message || `Maximum value is ${validations.max}`,
        });
      }
    }
  }

  private buildFieldSchema(field: FormField): any {
    let schema: any;

    // Handle array type
    if (field.type === 'array' && field.items) {
      let itemSchema: any;

      if (field.items.type === 'object' && field.items.properties) {
        // Build object schema for array items
        const objectShape: Record<string, any> = {};
        for (const [propName, propDef] of Object.entries(
          field.items.properties,
        )) {
          objectShape[propName] = this.buildItemPropertySchema(propDef);
        }
        itemSchema = z.object(objectShape);
      } else {
        // Build primitive schema for array items
        itemSchema = this.buildPrimitiveSchema(field.items.type);
        if (field.items.validations) {
          itemSchema = this.applyValidations(
            itemSchema,
            field.items.validations,
            field.items.type,
            true, // Array items are always required when present
          );
        }
      }

      schema = z.array(itemSchema);

      // Handle required/optional for arrays
      if (this.isOptionalField(field)) {
        schema = schema.optional();
      }
      return schema;
    }

    // Handle nested object type
    if (field.type === 'object' && field.fields) {
      const nestedShape: Record<string, any> = {};
      for (const nestedField of field.fields) {
        nestedShape[nestedField.name] = this.buildFieldSchema(nestedField);
      }
      schema = z.object(nestedShape);

      // Handle required/optional for objects
      if (this.isOptionalField(field)) {
        schema = schema.optional();
      }
      return schema;
    }

    // Build base schema based on field type
    switch (field.type) {
      case 'string':
        // For required strings, use z.string().min(1) to reject empty strings
        // For optional strings, use z.coerce.string() but allow empty
        if (!this.isOptionalField(field)) {
          schema = z.string().min(1, 'This field is required');
        } else {
          schema = z.coerce.string();
        }
        break;
      case 'email':
        schema = z.string().email('Invalid email format');
        break;
      case 'number':
        schema = z.coerce.number();
        break;
      case 'boolean':
        schema = z.boolean();
        break;
      case 'date':
        // For optional date fields, allow empty strings or valid dates
        if (this.isOptionalField(field)) {
          schema = z
            .string()
            .refine(
              (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
              'Invalid date format (expected YYYY-MM-DD)',
            );
        } else {
          // For required date fields, enforce the regex
          schema = z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              'Invalid date format (expected YYYY-MM-DD)',
            );
        }
        break;
      case 'select':
        schema = z.string();
        break;
      default:
        schema = z.any();
    }

    // Apply validations
    if (field.validations) {
      schema = this.applyValidations(
        schema,
        field.validations,
        field.type,
        field.required === true, // Only true means strictly required keep optional for objects
      );
    }

    // Handle required/optional
    if (this.isOptionalField(field)) {
      schema = schema.optional();
    }

    return schema;
  }

  private applyValidations(
    schema: any,
    validations: FieldValidation,
    fieldType: string,
    required = true,
  ): any {
    // Skip all validations for optional string fields with no value provided
    if (fieldType === 'string' && !required) {
      return schema.refine(
        (val: string) =>
          !val ||
          val.length === 0 ||
          this.validateStringValue(val, validations),
        { message: validations.message || 'Validation failed' },
      );
    }

    // Min/Max for strings (required fields)
    if (
      fieldType === 'string' &&
      (validations.min !== undefined || validations.max !== undefined)
    ) {
      if (validations.min !== undefined) {
        const minLength = validations.min;
        // Always enforce minimum length (use max(1, minLength) for required fields)
        const effectiveMin = required ? Math.max(1, minLength) : minLength;
        schema = schema.min(
          effectiveMin,
          validations.message || `Minimum length is ${effectiveMin}`,
        );
      } else if (required) {
        // If no min specified but field is required, enforce min length of 1
        schema = schema.min(1, validations.message || 'This field is required');
      }
      if (validations.max !== undefined) {
        schema = schema.max(
          validations.max,
          validations.message || `Maximum length is ${validations.max}`,
        );
      }
    } else if (fieldType === 'string' && required) {
      // If no validations but field is required, enforce non-empty string
      schema = schema.min(1, 'This field is required');
    }

    // Min/Max for numbers
    if (
      fieldType === 'number' &&
      (validations.min !== undefined || validations.max !== undefined)
    ) {
      if (validations.min !== undefined) {
        schema = schema.min(
          validations.min,
          validations.message || `Minimum value is ${validations.min}`,
        );
      }
      if (validations.max !== undefined) {
        schema = schema.max(
          validations.max,
          validations.message || `Maximum value is ${validations.max}`,
        );
      }
    }

    // Regex validation
    if (validations.regex) {
      try {
        const regex = new RegExp(validations.regex);
        if (required) {
          // For required fields, apply regex directly
          schema = schema.regex(regex, validations.message || 'Invalid format');
        } else {
          // For non-required fields, allow empty strings or strings that match the regex
          schema = schema.refine((val: string) => !val || regex.test(val), {
            message: validations.message || 'Invalid format',
          });
        }
      } catch (error) {
        throw new BadRequestException(
          `Invalid regex pattern: ${validations.regex}`,
        );
      }
    }

    return schema;
  }

  private validateStringValue(
    val: string,
    validations: FieldValidation,
  ): boolean {
    if (validations.min !== undefined && val.length < validations.min) {
      return false;
    }
    if (validations.max !== undefined && val.length > validations.max) {
      return false;
    }
    if (validations.regex) {
      try {
        const regex = new RegExp(validations.regex);
        if (!regex.test(val)) {
          return false;
        }
      } catch {
        return false;
      }
    }
    return true;
  }

  private buildPrimitiveSchema(type: string): any {
    switch (type) {
      case 'string':
        return z.coerce.string();
      case 'number':
        return z.coerce.number();
      case 'boolean':
        return z.boolean();
      default:
        return z.any();
    }
  }

  private buildItemPropertySchema(propDef: {
    type: string;
    validations?: FieldValidation;
  }): any {
    let schema = this.buildPrimitiveSchema(propDef.type);

    if (propDef.validations) {
      schema = this.applyValidations(
        schema,
        propDef.validations,
        propDef.type,
        true, // Array item properties are typically required when present
      );
    }

    return schema;
  }

  validateData(
    schema: ZodSchema,
    data: any,
  ): { success: boolean; errors?: any[] } {
    try {
      schema.parse(data);
      return { success: true };
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        return { success: false, errors };
      }
      throw error;
    }
  }
}
