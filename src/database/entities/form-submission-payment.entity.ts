import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Payment } from './payment.entity';

@Entity('form_submission_payments')
@Index(['formId', 'submissionId'], { unique: true })
@Index(['paymentId'])
export class FormSubmissionPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'form_id' })
  formId: string;

  @Column({ name: 'submission_id' })
  submissionId: string;

  @Column({ name: 'payment_id' })
  paymentId: string;

  @Column({ name: 'payment_required', default: true })
  paymentRequired: boolean;

  @Column({ name: 'payment_completed', default: false })
  paymentCompleted: boolean;

  @Column({ name: 'notification_sent', default: false })
  notificationSent: boolean;

  @Column({ name: 'encrypted_form_data', type: 'text', nullable: true })
  encryptedFormData?: string;

  @Column({ name: 'form_data_deleted', default: false })
  formDataDeleted: boolean;

  @ManyToOne(() => Payment, (payment) => payment.formSubmissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
