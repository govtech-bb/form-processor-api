import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateFeatureFlagAuditLogTable1775980800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'feature_flag_audit_log',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'service_slug',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'subpage_slug',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'scope',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'action',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'performed_by',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'performed_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'feature_flag_audit_log',
      new TableIndex({
        name: 'IDX_AUDIT_LOG_SERVICE_SLUG',
        columnNames: ['service_slug'],
      }),
    );

    await queryRunner.createIndex(
      'feature_flag_audit_log',
      new TableIndex({
        name: 'IDX_AUDIT_LOG_PERFORMED_AT',
        columnNames: ['performed_at'],
      }),
    );

    await queryRunner.createIndex(
      'feature_flag_audit_log',
      new TableIndex({
        name: 'IDX_AUDIT_LOG_PERFORMED_BY',
        columnNames: ['performed_by'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'feature_flag_audit_log',
      'IDX_AUDIT_LOG_PERFORMED_BY',
    );
    await queryRunner.dropIndex(
      'feature_flag_audit_log',
      'IDX_AUDIT_LOG_PERFORMED_AT',
    );
    await queryRunner.dropIndex(
      'feature_flag_audit_log',
      'IDX_AUDIT_LOG_SERVICE_SLUG',
    );
    await queryRunner.dropTable('feature_flag_audit_log');
  }
}
