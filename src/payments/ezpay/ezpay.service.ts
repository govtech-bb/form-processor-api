import { Injectable, Logger } from '@nestjs/common';
import {
  CreatePaymentParams,
  CreatePaymentResult,
  EZPayTransaction,
  EZPayVerifyResponse,
  QueryTransactionsResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from './interfaces';

/**
 * Mock EZPay service for testing purposes.
 * Returns hardcoded dummy data - swap with real EZPayService via DI for testing.
 */
@Injectable()
export class EZPayService {
  private readonly logger = new Logger(EZPayService.name);

  generateProcessId(): string {
    return 'MOCK_PROCESS_ID_' + Date.now();
  }

  getPaymentPageUrl(token: string, _customApiKey?: string): string {
    return `https://mock-ezpay.example.com/payment_page?token=${token}`;
  }

  async createPayment(
    params: CreatePaymentParams,
    _customApiKey?: string,
  ): Promise<CreatePaymentResult> {
    const {
      referenceNumber = 'MOCK_REF_' + Date.now(),
      processId = this.generateProcessId(),
      customerEmail,
    } = params;

    this.logger.log(`[MOCK] Creating payment for ${customerEmail}`);

    return {
      success: true,
      token: 'MOCK_TOKEN_abc123xyz789',
      paymentUrl:
        'https://mock-ezpay.example.com/payment_page?token=MOCK_TOKEN_abc123xyz789',
      referenceNumber,
      processId,
    };
  }

  async verifyPayment(
    params: VerifyPaymentParams,
    _customApiKey?: string,
  ): Promise<VerifyPaymentResult> {
    this.logger.log('[MOCK] Verifying payment', params);

    // Mock response matching EZPayVerifyResponse interface
    const mockResponse: EZPayVerifyResponse = {
      _status: 'Success',
      _transaction_number: params.transactionNumber || 'MOCK_TXN_123456',
      _ezpay_account: 'MOCK_ACCOUNT_001',
      _processor: 'Credit Card',
      _datesettled: new Date().toISOString(),
      _amount: '100.00',
      _details: JSON.stringify([
        JSON.stringify({
          AMOUNT_DUE: '100.00',
          EZPAY_ACCOUNT: 'MOCK_ACCOUNT_001',
          HEADER: 'Mock Payment',
          ITEMS: 'Test Item',
          NAME: 'Test Customer',
          amount: 100,
          code: 'TEST_CODE',
          details: 'Mock payment details',
          reference: params.reference || 'MOCK_REF_789',
          reference_email: 'test@example.com',
          reference_name: 'Test Customer',
          reference_number: params.reference || 'MOCK_REF_789',
          token: 'MOCK_TOKEN_abc123xyz789',
        }),
      ]),
    };

    return {
      success: true,
      data: mockResponse,
    };
  }

  async queryTransactions(
    startDate: string,
    endDate: string,
    _customApiKey?: string,
  ): Promise<QueryTransactionsResult> {
    this.logger.log(
      `[MOCK] Querying transactions from ${startDate} to ${endDate}`,
    );

    // Mock response matching EZPayTransaction interface
    const mockTransactions: EZPayTransaction[] = [
      {
        id: 'MOCK_ID_001',
        Date: startDate,
        TransactionCode: 'MOCK_TXN_001',
        Account: 'MOCK_ACCOUNT_001',
        Header: 'Mock Transaction 1',
        PaymentCode: 'PAY_CODE_001',
        Processor: 'Credit Card',
        Amount: '50.00',
        Response: 'Approved',
        Status: 'Success',
        DateInitiated: startDate,
        DateSettled: startDate,
        Details: JSON.stringify([{ item: 'Test Item 1' }]),
        Total: '50.00',
        Cart: [],
      },
      {
        id: 'MOCK_ID_002',
        Date: endDate,
        TransactionCode: 'MOCK_TXN_002',
        Account: 'MOCK_ACCOUNT_001',
        Header: 'Mock Transaction 2',
        PaymentCode: 'PAY_CODE_002',
        Processor: 'Direct Debit',
        Amount: '75.50',
        Response: 'Approved',
        Status: 'Success',
        DateInitiated: endDate,
        DateSettled: endDate,
        Details: JSON.stringify([{ item: 'Test Item 2' }]),
        Total: '75.50',
        Cart: [],
      },
    ];

    return {
      success: true,
      data: mockTransactions,
    };
  }

  validateWebhookSignature(_payload: string, _signature: string): boolean {
    this.logger.log(
      '[MOCK] Validating webhook signature - always returns true',
    );
    return true;
  }
}
