import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateServiceAccessConfigsTable1769600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'service_access_configs',
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
            /**
             * The subpage slug this row applies to (e.g. "start", "form").
             * Empty string is the sentinel for a service-level row that controls
             * category listing visibility.
             */
            name: 'subpage_slug',
            type: 'varchar',
            length: '255',
            default: "''",
          },
          {
            name: 'is_protected',
            type: 'boolean',
            default: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'service_access_configs',
      new TableIndex({
        name: 'IDX_SERVICE_ACCESS_SLUG_SUBPAGE',
        columnNames: ['service_slug', 'subpage_slug'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'service_access_configs',
      'IDX_SERVICE_ACCESS_SLUG_SUBPAGE',
    );
    await queryRunner.dropTable('service_access_configs');
  }
}
