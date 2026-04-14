import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeatureFlagsAuditTrigger1776067800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION log_feature_flag_change()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        resolved_scope varchar(20);
        resolved_action varchar(20);
        resolved_subpage_slug varchar(255);
        resolved_actor varchar(255);
      BEGIN
        IF TG_OP = 'UPDATE' AND NEW.is_protected IS NOT DISTINCT FROM OLD.is_protected THEN
          RETURN NEW;
        END IF;

        resolved_scope := CASE
          WHEN NEW.subpage_slug = '' THEN 'service'
          ELSE 'subpage'
        END;

        resolved_subpage_slug := CASE
          WHEN NEW.subpage_slug = '' THEN NULL
          ELSE NEW.subpage_slug
        END;

        resolved_action := CASE
          WHEN NEW.is_protected THEN 'enable'
          ELSE 'disable'
        END;

        resolved_actor := COALESCE(
          NULLIF(current_setting('app.audit_actor', true), ''),
          'system/db-client'
        );

        INSERT INTO feature_flag_audit_log (
          service_slug,
          subpage_slug,
          scope,
          action,
          performed_by
        )
        VALUES (
          NEW.service_slug,
          resolved_subpage_slug,
          resolved_scope,
          resolved_action,
          resolved_actor
        );

        RETURN NEW;
      END;
      $$;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_log_feature_flag_change
      AFTER INSERT OR UPDATE ON feature_flags
      FOR EACH ROW
      EXECUTE FUNCTION log_feature_flag_change();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trigger_log_feature_flag_change ON feature_flags;
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS log_feature_flag_change();
    `);
  }
}
