import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformedByNameToAuditLog1776153600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE feature_flag_audit_log
      ADD COLUMN performed_by_name VARCHAR(255) DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE feature_flag_audit_log
      DROP COLUMN performed_by_name
    `);
  }
}
