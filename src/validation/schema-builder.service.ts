import { Injectable, BadRequestException } from '@nestjs/common';
import { z, ZodSchema, ZodError } from 'zod';
import { FormSchema, FormField, FieldValidation } from '../forms/interfaces';

@Injectable()
export class SchemaBuilderService {
  buildZodSchema(formSchema: FormSchema): ZodSchema {
    const shape: Record<string, any> = {};

    for (const field of formSchema.fields) {
      shape[field.name] = this.buildFieldSchema(field);
    }

    return z.object(shape);
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
      if (!field.required) {
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
      if (!field.required) {
        schema = schema.optional();
      }
      return schema;
    }

    // Build base schema based on field type
    switch (field.type) {
      case 'string':
        // For required strings, use z.string().min(1) to reject empty strings
        // For optional strings, use z.coerce.string() but allow empty
        if (field.required) {
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
        if (!field.required) {
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
        field.required,
      );
    }

    // Handle required/optional
    if (!field.required) {
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
    // Min/Max for strings
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
