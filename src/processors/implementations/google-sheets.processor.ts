import { Injectable, Logger } from '@nestjs/common';
import { IProcessor, ProcessorContext } from '../interfaces';
import { GoogleSheetsService } from '../../google-sheets/google-sheets.service';

type GoogleSheetsProcessorConfig = {
  /**
   * The ID of the Google Sheet (from the URL)
   * Can be a database secret: {{db:spreadsheet_id}}
   */
  spreadsheetId: string;

  /**
   * The name of the sheet/tab to append to (defaults to 'Sheet1')
   */
  sheetName?: string;

  /**
   * Array of field names from form data to include in the row.
   * Uses dot notation for nested fields: 'personal.firstName'
   * Special values:
   * - '_submissionId': includes the submission ID
   * - '_formId': includes the form ID
   * - '_timestamp': includes the current timestamp
   */
  fields: string[];

  /**
   * Optional custom headers for the columns.
   * If not provided, field names will be used as headers.
   */
  headers?: string[];

  /**
   * Whether to include headers on first submission (default: true)
   */
  includeHeaders?: boolean;
};

@Injectable()
export class GoogleSheetsProcessor implements IProcessor {
  readonly type = 'google-sheets';
  private readonly logger = new Logger(GoogleSheetsProcessor.name);

  constructor(private readonly googleSheetsService: GoogleSheetsService) {}

  async execute(
    config: GoogleSheetsProcessorConfig,
    context: ProcessorContext,
  ): Promise<void> {
    this.logger.log(
      `Executing Google Sheets processor for form: ${context.formId}`,
    );

    const {
      spreadsheetId,
      sheetName = 'Sheet1',
      fields,
      headers,
      includeHeaders = true,
    } = config;

    if (!spreadsheetId) {
      this.logger.warn(
        `Google Sheets processor skipped: "spreadsheetId" is missing in config for submission: ${context.submissionId}`,
      );
      return;
    }

    if (!fields || fields.length === 0) {
      this.logger.warn(
        `Google Sheets processor skipped: "fields" array is empty or missing in config for submission: ${context.submissionId}`,
      );
      return;
    }

    // Extract values from form data based on field configuration
    const values = fields.map((field) => this.extractValue(field, context));

    // Use custom headers or derive from field names
    const columnHeaders = headers || fields.map((f) => this.formatHeader(f));

    if (includeHeaders) {
      await this.googleSheetsService.appendRowWithHeaders({
        spreadsheetId,
        sheetName,
        headers: columnHeaders,
        values,
      });
    } else {
      await this.googleSheetsService.appendRow({
        spreadsheetId,
        sheetName,
        values,
      });
    }

    this.logger.log(
      `Google Sheets row appended successfully for submission: ${context.submissionId}`,
    );
  }

  /**
   * Extract a value from the processor context based on field specification
   */
  private extractValue(
    field: string,
    context: ProcessorContext,
  ): string | number | boolean | null {
    // Handle special meta fields
    if (field === '_submissionId') {
      return context.submissionId;
    }
    if (field === '_formId') {
      return context.formId;
    }
    if (field === '_timestamp') {
      return new Date().toISOString();
    }

    // Handle nested field access with dot notation
    const parts = field.split('.');
    let value: unknown = context.data;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return null;
      }
      if (typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        this.logger.debug(
          `Field "${field}" not found in form data for submission: ${context.submissionId}`,
        );
        return null;
      }
    }

    // Handle different value types
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Format a field name into a human-readable header
   */
  private formatHeader(field: string): string {
    // Handle special fields
    if (field === '_submissionId') return 'Submission ID';
    if (field === '_formId') return 'Form ID';
    if (field === '_timestamp') return 'Timestamp';

    // Get the last part of nested fields and convert to title case
    const lastPart = field.split('.').pop() || field;
    return lastPart
      .replace(/([A-Z])/g, ' $1') // Add space before capitals
      .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
      .trim()
      .replace(/^\w/, (c) => c.toUpperCase()); // Capitalize first letter
  }
}
