import { HttpException, HttpStatus } from '@nestjs/common';
import { EZPAY_ERROR_CODES, EZPayErrorCode } from '../interfaces';

export class EZPayException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly ezpayCode?: EZPayErrorCode,
  ) {
    super(
      {
        message,
        error: 'EZPay Error',
        ezpayCode,
        ezpayMessage: ezpayCode ? EZPAY_ERROR_CODES[ezpayCode] : undefined,
      },
      status,
    );
  }
}

export class EZPayConfigurationException extends EZPayException {
  constructor(message: string) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export class EZPayValidationException extends EZPayException {
  constructor(message: string, ezpayCode?: EZPayErrorCode) {
    super(message, HttpStatus.BAD_REQUEST, ezpayCode);
  }
}

export class EZPayNetworkException extends EZPayException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_GATEWAY);
  }
}

export class EZPayTimeoutException extends EZPayException {
  constructor(message: string) {
    super(message, HttpStatus.REQUEST_TIMEOUT);
  }
}
