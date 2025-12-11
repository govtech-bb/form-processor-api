import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { EZPayException } from './ezpay.exception';

@Catch(EZPayException)
export class EZPayExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(EZPayExceptionFilter.name);

  catch(exception: EZPayException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: exception.message,
      error: 'EZPay Error',
      ezpayCode: exception.ezpayCode,
      ezpayMessage: exception.ezpayCode
        ? exception.getResponse()['ezpayMessage']
        : undefined,
    };

    this.logger.error(`EZPay Exception: ${exception.message}`, {
      status,
      ezpayCode: exception.ezpayCode,
      path: request.url,
      method: request.method,
      stack: exception.stack,
    });

    response.status(status).json(errorResponse);
  }
}
