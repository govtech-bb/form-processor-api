import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameServiceAccessConfigsToFeatureFlags1776067200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameTable('service_access_configs', 'feature_flags');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameTable('feature_flags', 'service_access_configs');
  }
}
