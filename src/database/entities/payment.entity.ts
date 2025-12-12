import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { FormSubmissionPayment } from './form-submission-payment.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  INITIATED = 'initiated',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentProvider {
  EZPAY = 'ezpay',
}

@Entity('payments')
@Index(['referenceNumber'], { unique: true })
@Index(['processId'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reference_number', unique: true })
  referenceNumber: string;

  @Column({ name: 'process_id', unique: true })
  processId: string;

  @Column({ name: 'payment_provider', type: 'enum', enum: PaymentProvider })
  paymentProvider: PaymentProvider;

  @Column({ name: 'payment_token', nullable: true })
  paymentToken?: string;

  @Column({ name: 'payment_url', nullable: true })
  paymentUrl?: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ name: 'customer_email' })
  customerEmail: string;

  @Column({ name: 'customer_name' })
  customerName: string;

  @Column({ name: 'payment_code' })
  paymentCode: string;

  @Column({ name: 'description', nullable: true })
  description?: string;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => FormSubmissionPayment, (submission) => submission.payment)
  formSubmissions: FormSubmissionPayment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
