import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemovePaymentVerified1769545016193 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('form_submission_payments');
    const column = table?.findColumnByName('payment_verified');

    if (column) {
      await queryRunner.dropColumn(
        'form_submission_payments',
        'payment_verified',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'form_submission_payments',
      new TableColumn({
        name: 'payment_verified',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );
  }
}
