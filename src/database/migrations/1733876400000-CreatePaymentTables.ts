import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreatePaymentTables1733876400000 implements MigrationInterface {
  name = 'CreatePaymentTables1733876400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create custom enums first
    await queryRunner.query(`
      CREATE TYPE "payment_provider_enum" AS ENUM('ezpay')
    `);

    await queryRunner.query(`
      CREATE TYPE "payment_status_enum" AS ENUM('pending', 'initiated', 'success', 'failed', 'cancelled', 'refunded')
    `);

    await queryRunner.query(`
      CREATE TYPE "transaction_status_enum" AS ENUM('Initiated', 'Success', 'Failed')
    `);

    await queryRunner.query(`
      CREATE TYPE "transaction_processor_enum" AS ENUM('Credit Card', 'Direct Debit', 'Payce', 'mMoney')
    `);

    // Create payments table
    await queryRunner.createTable(
      new Table({
        name: 'payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'reference_number',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'process_id',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'payment_provider',
            type: 'enum',
            enum: ['ezpay'],
          },
          {
            name: 'payment_token',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'payment_url',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'total_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'pending',
              'initiated',
              'success',
              'failed',
              'cancelled',
              'refunded',
            ],
            default: "'pending'",
          },
          {
            name: 'customer_email',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'customer_name',
            type: 'varchar',
          },
          {
            name: 'payment_code',
            type: 'varchar',
          },
          {
            name: 'description',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'allow_credit',
            type: 'boolean',
            default: true,
          },
          {
            name: 'allow_debit',
            type: 'boolean',
            default: true,
          },
          {
            name: 'allow_payce',
            type: 'boolean',
            default: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create indexes for payments table
    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_reference_number',
        columnNames: ['reference_number'],
      }),
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_process_id',
        columnNames: ['process_id'],
      }),
    );

    // Create payment_transactions table
    await queryRunner.createTable(
      new Table({
        name: 'payment_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'payment_id',
            type: 'varchar',
          },
          {
            name: 'transaction_number',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'ezpay_account',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'processor',
            type: 'enum',
            enum: ['Credit Card', 'Direct Debit', 'Payce', 'mMoney'],
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['Initiated', 'Success', 'Failed'],
            default: "'Initiated'",
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'date_settled',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'date_initiated',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'details',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'response_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'callback_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create indexes for payment_transactions table
    await queryRunner.createIndex(
      'payment_transactions',
      new TableIndex({
        name: 'IDX_payment_transactions_transaction_number',
        columnNames: ['transaction_number'],
      }),
    );

    await queryRunner.createIndex(
      'payment_transactions',
      new TableIndex({
        name: 'IDX_payment_transactions_payment_id',
        columnNames: ['payment_id'],
      }),
    );

    await queryRunner.createIndex(
      'payment_transactions',
      new TableIndex({
        name: 'IDX_payment_transactions_status',
        columnNames: ['status'],
      }),
    );

    // Create form_submission_payments table
    await queryRunner.createTable(
      new Table({
        name: 'form_submission_payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'form_id',
            type: 'varchar',
          },
          {
            name: 'submission_id',
            type: 'varchar',
          },
          {
            name: 'payment_id',
            type: 'uuid',
          },
          {
            name: 'payment_required',
            type: 'boolean',
            default: true,
          },
          {
            name: 'payment_completed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'payment_verified',
            type: 'boolean',
            default: false,
          },
          {
            name: 'notification_sent',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create indexes for form_submission_payments table
    await queryRunner.createIndex(
      'form_submission_payments',
      new TableIndex({
        name: 'IDX_form_submission_payments_form_submission',
        columnNames: ['form_id', 'submission_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'form_submission_payments',
      new TableIndex({
        name: 'IDX_form_submission_payments_payment_id',
        columnNames: ['payment_id'],
      }),
    );

    // Create foreign key constraint
    await queryRunner.createForeignKey(
      'form_submission_payments',
      new TableForeignKey({
        name: 'FK_form_submission_payments_payment',
        columnNames: ['payment_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'payments',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint first
    await queryRunner.dropForeignKey(
      'form_submission_payments',
      'FK_form_submission_payments_payment',
    );

    // Drop indexes for form_submission_payments
    await queryRunner.dropIndex(
      'form_submission_payments',
      'IDX_form_submission_payments_payment_id',
    );
    await queryRunner.dropIndex(
      'form_submission_payments',
      'IDX_form_submission_payments_form_submission',
    );

    // Drop form_submission_payments table
    await queryRunner.dropTable('form_submission_payments');

    // Drop indexes for payment_transactions
    await queryRunner.dropIndex(
      'payment_transactions',
      'IDX_payment_transactions_status',
    );
    await queryRunner.dropIndex(
      'payment_transactions',
      'IDX_payment_transactions_payment_id',
    );
    await queryRunner.dropIndex(
      'payment_transactions',
      'IDX_payment_transactions_transaction_number',
    );

    // Drop payment_transactions table
    await queryRunner.dropTable('payment_transactions');

    // Drop indexes for payments
    await queryRunner.dropIndex('payments', 'IDX_payments_process_id');
    await queryRunner.dropIndex('payments', 'IDX_payments_reference_number');

    // Drop payments table
    await queryRunner.dropTable('payments');

    // Drop custom enums
    await queryRunner.query(`DROP TYPE "transaction_processor_enum"`);
    await queryRunner.query(`DROP TYPE "transaction_status_enum"`);
    await queryRunner.query(`DROP TYPE "payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "payment_provider_enum"`);
  }
}
