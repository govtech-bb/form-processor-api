import {
  Injectable,
  NotFoundException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FormConfig } from '../database/entities';
import { FormSchema } from './interfaces';

@Injectable()
export class FormUtilsService implements OnModuleInit {
  private readonly logger = new Logger(FormUtilsService.name);
  private readonly schemasDir: string;
  private formSchemas: Map<string, FormSchema> = new Map();

  constructor(
    @InjectRepository(FormConfig)
    private readonly formConfigRepository: Repository<FormConfig>,
    private readonly configService: ConfigService,
  ) {
    this.schemasDir = path.join(
      process.cwd(),
      this.configService.get('forms.schemasDir'),
    );
  }

  async onModuleInit() {
    await this.loadAllSchemas();
  }

  /**
   * Load all form schemas from the schemas directory
   */
  async loadAllSchemas(): Promise<void> {
    try {
      const files = await fs.readdir(this.schemasDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      for (const file of jsonFiles) {
        const filePath = path.join(this.schemasDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const schema: FormSchema = JSON.parse(content);
        this.formSchemas.set(schema.id, schema);
        this.logger.log(`Loaded form schema: ${schema.id}`);
      }

      this.logger.log(`Total form schemas loaded: ${this.formSchemas.size}`);
    } catch (error) {
      this.logger.error('Error loading form schemas:', error);
      throw error;
    }
  }

  /**
   * Get all available form schemas
   */
  getAllSchemas(): FormSchema[] {
    return Array.from(this.formSchemas.values());
  }

  /**
   * Get a specific form schema by ID
   */
  getSchema(formId: string): FormSchema {
    const schema = this.formSchemas.get(formId);
    if (!schema) {
      throw new NotFoundException(`Form schema with id "${formId}" not found`);
    }

    // Return a deep copy to prevent mutations
    return JSON.parse(JSON.stringify(schema));
  }

  /**
   * Get a form schema with database secrets replaced
   * Optionally replace form data variables as well
   */
  async getSchemaWithSecrets(
    formId: string,
    formData?: Record<string, any>,
  ): Promise<FormSchema> {
    const schema = this.getSchema(formId);

    // Replace secret variables and form data in processor configs
    for (const processor of schema.processors) {
      processor.config = await this.replaceVariables(
        formId,
        processor.config,
        formData,
      );
    }

    return schema;
  }

  /**
   * Replace all variable patterns (database secrets and form data) in a config object
   */
  private async replaceVariables(
    formId: string,
    config: Record<string, any>,
    formData?: Record<string, any>,
  ): Promise<Record<string, any>> {
    const result = { ...config };

    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'string') {
        result[key] = await this.replaceVariableValue(formId, value, formData);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = await this.replaceVariables(formId, value, formData);
      }
    }

    return result;
  }

  /**
   * Replace both database secrets and form data variables in a string value
   * Supports:
   * - {{db:key}} or {{db:formId:key}} for database secrets
   * - {{formData.fieldName}} for form field values
   */
  private async replaceVariableValue(
    formId: string,
    value: string,
    formData?: Record<string, any>,
  ): Promise<string> {
    let result = value;

    // Replace database secrets: {{db:key}} or {{db:formId:key}}
    result = await this.replaceDbSecrets(formId, result);

    // Replace form data variables: {{formData.fieldName}}
    if (formData) {
      result = this.replaceFormData(result, formData);
    }

    return result;
  }

  /**
   * Replace database secret patterns in a string
   */
  private async replaceDbSecrets(
    formId: string,
    value: string,
  ): Promise<string> {
    const regex = /\{\{db:([^}]+)\}\}/g;
    let result = value;

    const matches = value.matchAll(regex);
    for (const match of matches) {
      const parts = match[1].split(':');
      let targetFormId: string;
      let targetKey: string;

      if (parts.length === 1) {
        // Shorthand: {{db:key}} - use current formId
        targetFormId = formId;
        targetKey = parts[0];
      } else {
        // Full format: {{db:formId:key}}
        targetFormId = parts[0];
        targetKey = parts[1];
      }

      const secretValue = await this.getSecret(targetFormId, targetKey);
      result = result.replace(match[0], secretValue);
    }

    return result;
  }

  /**
   * Replace form data patterns in a string
   * Supports: {{formData.fieldName}} and nested paths like {{formData.nested.keyName}}
   */
  private replaceFormData(
    value: string,
    formData: Record<string, any>,
  ): string {
    const regex = /\{\{formData\.([^}]+)\}\}/g;
    let result = value;

    const matches = value.matchAll(regex);
    for (const match of matches) {
      const fieldPath = match[1];
      const fieldValue = this.getNestedValue(formData, fieldPath);

      if (fieldValue !== undefined && fieldValue !== null) {
        // Convert to string and replace
        result = result.replace(match[0], String(fieldValue));
      } else {
        this.logger.warn(
          `Form data field not found: ${fieldPath}, removing from string`,
        );
        // Remove the placeholder if field not found
        result = result.replace(match[0], '');
      }
    }

    return result;
  }

  /**
   * Get a nested value from an object using a dot-separated path
   * Example: getNestedValue({child: {firstName: 'John'}}, 'child.firstName') => 'John'
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Retrieve a secret value from the database
   */
  private async getSecret(formId: string, key: string): Promise<string> {
    const config = await this.formConfigRepository.findOne({
      where: { formId, key },
    });

    if (!config) {
      this.logger.warn(`Secret not found: ${formId}:${key}`);
      return `{{db:${formId}:${key}}}`; // Return placeholder if not found
    }

    return config.value;
  }

  /**
   * Reload all form schemas from disk
   */
  async reloadSchemas(): Promise<void> {
    this.formSchemas.clear();
    await this.loadAllSchemas();
    this.logger.log('Form schemas reloaded');
  }

  /**
   * Check if a form schema exists
   */
  hasSchema(formId: string): boolean {
    return this.formSchemas.has(formId);
  }

  /**
   * Get the count of loaded schemas
   */
  getSchemaCount(): number {
    return this.formSchemas.size;
  }
}
