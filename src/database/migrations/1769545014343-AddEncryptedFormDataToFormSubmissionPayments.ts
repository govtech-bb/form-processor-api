import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEncryptedFormDataToFormSubmissionPayments1769545014343
  implements MigrationInterface
{
  name = 'AddEncryptedFormDataToFormSubmissionPayments1769545014343';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'form_submission_payments',
      new TableColumn({
        name: 'encrypted_form_data',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'form_submission_payments',
      new TableColumn({
        name: 'form_data_deleted',
        type: 'boolean',
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(
      'form_submission_payments',
      'form_data_deleted',
    );
    await queryRunner.dropColumn(
      'form_submission_payments',
      'encrypted_form_data',
    );
  }
}
