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
import { ExpressionResolverService } from './expression-resolver.service';

@Injectable()
export class FormUtilsService implements OnModuleInit {
  private readonly logger = new Logger(FormUtilsService.name);
  private readonly schemasDir: string;
  private formSchemas: Map<string, FormSchema> = new Map();

  constructor(
    @InjectRepository(FormConfig)
    private readonly formConfigRepository: Repository<FormConfig>,
    private readonly configService: ConfigService,
    private readonly expressionResolver: ExpressionResolverService,
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

        try {
          const schema: FormSchema = JSON.parse(content);
          this.formSchemas.set(schema.id, schema);
          this.logger.log(`Loaded form schema: ${schema.id} (${file})`);
        } catch (parseError) {
          this.logger.error(`Failed to parse schema file: ${file}`, parseError);
          throw parseError;
        }
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

    // Use centralized expression resolver for processor configs
    const context = {
      formId,
      formData: formData || {},
      configRepository: this.formConfigRepository,
    };

    for (const processor of schema.processors) {
      processor.config = await this.expressionResolver.resolveObjectExpressions(
        processor.config,
        context,
      );
    }

    return schema;
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
