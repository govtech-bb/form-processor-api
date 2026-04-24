import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the feature_flag_change trigger function to also populate
 * performed_by_name from the app.audit_actor_name session variable, which
 * ServiceAccessService now sets alongside app.audit_actor before every
 * transactional upsert.
 *
 * The column itself was added in migration 1776153600000. This migration
 * only updates the trigger so trigger-created rows populate it instead of
 * leaving it NULL.
 */
export class AddActorNameToAuditTrigger1776326400000
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
        resolved_actor_name varchar(255);
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

        -- Empty string is the sentinel for "not provided"; treat it as NULL.
        resolved_actor_name := NULLIF(current_setting('app.audit_actor_name', true), '');

        INSERT INTO feature_flag_audit_log (
          service_slug,
          subpage_slug,
          scope,
          action,
          performed_by,
          performed_by_name
        )
        VALUES (
          NEW.service_slug,
          resolved_subpage_slug,
          resolved_scope,
          resolved_action,
          resolved_actor,
          resolved_actor_name
        );

        RETURN NEW;
      END;
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the trigger function to the state left by 1776067800000,
    // before performed_by_name support was added.
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
  }
}
