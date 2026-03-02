# Automated Database Setup for Sandbox

This document explains how the database is automatically configured when App Runner starts after a teardown/rebuild using OpenTofu.

## How It Works

### OpenTofu Configuration

The App Runner service is configured in `alpha-infra/environments/sandbox/apprunner.tf`:

```hcl
start_command = "npm run db:migrate && npm run start:prod"
```

And includes the environment variable:
```hcl
ENVIRONMENT = "sandbox"
```

### Startup Sequence

When App Runner starts (after OpenTofu apply), it executes:
```bash
npm run db:migrate && npm run start:prod
```

This runs two operations in sequence:

### 1. Run All Migrations (`npm run db:migrate`)

Executes all pending TypeORM migrations in order:

1. **CreatePaymentTables** (1733876400000)
   - Creates `payments` table
   - Creates `payment_transactions` table
   - Creates `form_submission_payments` table
   - Adds indexes and foreign keys

2. **CreateFormConfigsTable** (1763429936199)
   - Creates `form_configs` table
   - Adds unique index on (form_id, key)

3. **SeedFormConfigsSandbox** (1763500000000)
   - **Only runs in sandbox** (checks `ENVIRONMENT` variable)
   - Seeds 25 form configurations
   - Sets all admin emails to `laron.maughn@govtech.bb`
   - Uses `ON CONFLICT DO UPDATE` for idempotency

4. **AddEncryptedFormDataToFormSubmissionPayments** (1769545014343)
   - Adds `encrypted_form_data` column
   - Adds `form_data_deleted` column

5. **RemovePaymentVerified** (1769545016193)
   - Removes deprecated `payment_verified` column

### 2. Start Application (`npm run start:prod`)

Starts the NestJS application after migrations complete.

## What Gets Created Automatically

### In All Environments (Sandbox + Production)

**Tables:**
- `payments` (empty)
- `payment_transactions` (empty)
- `form_submission_payments` (empty)
- `form_configs` (empty in production)

### In Sandbox Only

**Seeded Data in `form_configs`:**
- 25 configurations for 19 forms
- All admin emails: `laron.maughn@govtech.bb`
- Payment codes and amounts for certificate forms

## Environment Detection

The seeding migration checks the `ENVIRONMENT` environment variable:

```typescript
const environment = process.env.ENVIRONMENT || 'production';
if (environment !== 'sandbox') {
  console.log('Skipping sandbox seed data - not in sandbox environment');
  return;
}
```

## Idempotency

All operations are idempotent (safe to run multiple times):

- **Migrations**: TypeORM tracks which migrations have run
- **Seeding**: Uses `ON CONFLICT DO UPDATE` to update existing records

## After Teardown/Rebuild with OpenTofu

1. Run `tofu destroy` → Sandbox infrastructure destroyed, database deleted
2. Run `tofu apply` → Sandbox rebuilt
3. App Runner starts automatically
4. **Migrations run automatically** ✅
5. **Sandbox data seeded automatically** ✅
6. Application starts
7. Ready for testing!

## Deploying the Changes

To apply the automated setup:

```bash
cd alpha-infra/environments/sandbox
tofu plan   # Review changes
tofu apply  # Apply changes
```

This will update the App Runner service with the new start command.

## Manual Re-seeding (If Needed)

If you need to re-seed without redeploying:

**Option 1: PowerShell Script**
```powershell
cd form-processor-api/scripts
.\reseed-sandbox.ps1
```

**Option 2: SQL Script**
```powershell
psql -h <host> -U postgres -d form_processor_db -f seed-form-configs-sandbox.sql
```

**Option 3: Restart App Runner**
App Runner will re-run migrations on restart (but won't re-seed if data exists due to ON CONFLICT)

## Adding New Forms

To add a new form configuration:

1. Update `SeedFormConfigsSandbox` migration with new form
2. Redeploy App Runner (or run migration manually)
3. Configuration will be added automatically

## Production Setup

For production, create a separate seeding migration:

```typescript
export class SeedFormConfigsProduction implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const environment = process.env.ENVIRONMENT || 'production';
    if (environment !== 'production') {
      return;
    }

    // Seed with real government emails
    await queryRunner.query(`
      INSERT INTO form_configs (form_id, key, value, description)
      VALUES
        ('get-birth-certificate', 'admin_email', 'registrar@gov.bb', 'Birth certificate submissions'),
        ...
    `);
  }
}
```

## Troubleshooting

**Migrations not running:**
- Check App Runner logs for migration errors
- Verify database credentials in environment variables
- Ensure `ENVIRONMENT` variable is set correctly

**Seeding not happening:**
- Check `ENVIRONMENT` variable is set to `sandbox`
- Look for "Seeding form_configs for sandbox environment..." in logs
- Verify migration timestamp is correct (runs after CreateFormConfigsTable)

**Data not updating:**
- Seeding uses `ON CONFLICT DO UPDATE`
- Existing data will be updated with new values
- To force fresh data, delete from `form_configs` table first

## Related Files

- `src/database/migrations/1763500000000-SeedFormConfigsSandbox.ts` - Seeding migration
- `scripts/seed-form-configs-sandbox.sql` - Manual SQL seed script
- `scripts/reseed-sandbox.ps1` - PowerShell re-seeding script
- `scripts/create-payment-tables.sql` - Manual payment tables creation
