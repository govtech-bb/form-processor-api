import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TransactionStatus {
  INITIATED = 'Initiated',
  SUCCESS = 'Success',
  FAILED = 'Failed',
}

export enum TransactionProcessor {
  CREDIT_CARD = 'Credit Card',
  DIRECT_DEBIT = 'Direct Debit',
  PAYCE = 'Payce',
  MMONEY = 'mMoney',
}

@Entity('payment_transactions')
@Index(['transactionNumber'], { unique: true })
@Index(['paymentId'])
@Index(['status'])
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id' })
  paymentId: string;

  @Column({ name: 'transaction_number', unique: true })
  transactionNumber: string;

  @Column({ name: 'account_code', nullable: true })
  accountCode?: string;

  @Column({
    name: 'processor',
    type: 'enum',
    enum: TransactionProcessor,
    nullable: true,
  })
  processor?: TransactionProcessor;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.INITIATED,
  })
  status: TransactionStatus;

  @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ name: 'date_settled', type: 'timestamp', nullable: true })
  dateSettled?: Date;

  @Column({
    name: 'date_initiated',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  dateInitiated: Date;

  @Column({ name: 'details', nullable: true })
  details?: string;

  @Column({ name: 'response_data', type: 'jsonb', nullable: true })
  responseData?: Record<string, any>;

  @Column({ name: 'callback_data', type: 'jsonb', nullable: true })
  callbackData?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
