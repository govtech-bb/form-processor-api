import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

export type GoogleSheetsAppendConfig = {
  spreadsheetId: string;
  sheetName?: string;
  values: (string | number | boolean | null | undefined)[];
};

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private sheets: sheets_v4.Sheets | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize the Google Sheets client with service account credentials
   */
  private async getClient(): Promise<sheets_v4.Sheets> {
    if (this.sheets) {
      return this.sheets;
    }

    const clientEmail = this.configService.get<string>(
      'googleSheets.clientEmail',
    );
    const privateKey = this.configService.get<string>(
      'googleSheets.privateKey',
    );

    if (!clientEmail || !privateKey) {
      throw new Error(
        'Google Sheets credentials not configured. Set GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY environment variables.',
      );
    }

    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
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
