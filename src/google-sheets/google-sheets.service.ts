import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

export type GoogleSheetsAppendConfig = {
  spreadsheetId: string;
  sheetName?: string;
  values: (string | number | boolean | null | undefined)[];
};

type GoogleServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private sheets: sheets_v4.Sheets | null = null;
  private cachedCredentials: GoogleServiceAccountCredentials | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Fetch Google service account credentials from AWS Secrets Manager.
   * Used in production environments where credentials are stored securely in AWS.
   */
  private async getCredentialsFromSecretsManager(): Promise<GoogleServiceAccountCredentials> {
    if (this.cachedCredentials) {
      return this.cachedCredentials;
    }

    const region = this.configService.get<string>('aws.region') || 'us-east-1';
    const secretName = this.configService.get<string>(
      'googleSheets.awsSecretName',
    );
    const client = new SecretsManagerClient({ region });

    this.logger.log(
      `Fetching Google Sheets credentials from AWS Secrets Manager (secret: ${secretName})`,
    );

    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: 'AWSCURRENT',
      }),
    );

    if (!response.SecretString) {
      throw new Error(
        `Secret ${secretName} not found or has no string value`,
      );
    }

    const credentials = JSON.parse(
      response.SecretString,
    ) as GoogleServiceAccountCredentials;

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error(
        `Secret ${secretName} is missing required fields: client_email and/or private_key`,
      );
    }

    this.cachedCredentials = credentials;
    return credentials;
  }

  /**
   * Get credentials from environment variables (local development).
   */
  private getCredentialsFromEnv(): GoogleServiceAccountCredentials | null {
    const clientEmail = this.configService.get<string>(
      'googleSheets.clientEmail',
    );
    const privateKey = this.configService.get<string>(
      'googleSheets.privateKey',
    );

    if (!clientEmail || !privateKey) {
      return null;
    }

    return {
      client_email: clientEmail,
      private_key: privateKey,
    };
  }

  /**
   * Initialize the Google Sheets client with service account credentials.
   * In production (NODE_ENV=production), credentials are fetched from AWS Secrets Manager.
   * In development, credentials are loaded from environment variables.
   */
  private async getClient(): Promise<sheets_v4.Sheets> {
    if (this.sheets) {
      return this.sheets;
    }

    const isProduction =
      this.configService.get<string>('app.nodeEnv') === 'production';

    let credentials: GoogleServiceAccountCredentials;

    if (isProduction) {
      // Production: Fetch credentials from AWS Secrets Manager
      credentials = await this.getCredentialsFromSecretsManager();
    } else {
      // Development: Use environment variables
      const envCredentials = this.getCredentialsFromEnv();
      if (!envCredentials) {
        throw new Error(
          'Google Sheets credentials not configured. Set GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY environment variables.',
        );
      }
      credentials = envCredentials;
    }

    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    return this.sheets;
  }

  /**
   * Append a row of values to a Google Sheet
   */
  async appendRow(config: GoogleSheetsAppendConfig): Promise<void> {
    const { spreadsheetId, sheetName = 'Sheet1', values } = config;

    this.logger.log(
      `Appending row to spreadsheet ${spreadsheetId}, sheet: ${sheetName}`,
    );

    const sheets = await this.getClient();

    // Convert all values to strings for the API, handling null/undefined
    const stringValues = values.map((v) => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      return String(v);
    });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [stringValues],
      },
    });

    this.logger.log(
      `Row appended successfully. Updated range: ${response.data.updates?.updatedRange}`,
    );
  }

  /**
   * Append a row to a Google Sheet with column headers.
   * On first submission, adds headers if the sheet is empty.
   */
  async appendRowWithHeaders(config: {
    spreadsheetId: string;
    sheetName?: string;
    headers: string[];
    values: (string | number | boolean | null | undefined)[];
  }): Promise<void> {
    const { spreadsheetId, sheetName = 'Sheet1', headers, values } = config;

    this.logger.log(
      `Appending row with headers to spreadsheet ${spreadsheetId}, sheet: ${sheetName}`,
    );

    const sheets = await this.getClient();

    // Check if the sheet already has data
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:A1`,
    });

    const hasData =
      existingData.data.values && existingData.data.values.length > 0;

    // Convert values to strings
    const stringValues = values.map((v) => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      return String(v);
    });

    if (!hasData) {
      // Sheet is empty - add headers first, then the data row
      this.logger.log('Sheet is empty, adding headers first');
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [headers, stringValues],
        },
      });
    } else {
      // Sheet has data - just append the row
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [stringValues],
        },
      });
    }

    this.logger.log('Row appended successfully');
  }
}
