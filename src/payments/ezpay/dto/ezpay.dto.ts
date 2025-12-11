import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class EZPayCartItemDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  details: string;

  @IsString()
  @IsNotEmpty()
  reference: string;
}

export class CreatePaymentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EZPayCartItemDto)
  cartItems: EZPayCartItemDto[];

  @IsEmail()
  @IsNotEmpty()
  customerEmail: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  processId?: string;

  @IsOptional()
  @IsBoolean()
  allowCredit?: boolean;

  @IsOptional()
  @IsBoolean()
  allowDebit?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPayce?: boolean;
}

export class VerifyPaymentDto {
  @IsOptional()
  @IsString()
  transactionNumber?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class QueryTransactionsDto {
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @IsString()
  @IsNotEmpty()
  endDate: string;
}

export class ChangeTransactionStatusDto {
  @IsString()
  @IsNotEmpty()
  transactionNumber: string;

  @IsString()
  @IsNotEmpty()
  status: 'Success' | 'Failed' | 'Initiated';
}

export class EZPayCallbackDto {
  @IsString()
  @IsNotEmpty()
  _reference: string;

  @IsString()
  @IsNotEmpty()
  _status: 'Success' | 'Failed' | 'Initiated';

  @IsString()
  @IsNotEmpty()
  _transaction_number: string;

  @IsString()
  @IsNotEmpty()
  _ezpay_account: string;

  @IsString()
  @IsNotEmpty()
  _processor: string;

  @IsString()
  @IsNotEmpty()
  _datesettled: string;

  @IsString()
  @IsNotEmpty()
  _amount: string;

  @IsString()
  @IsNotEmpty()
  _pcode: string;
}
