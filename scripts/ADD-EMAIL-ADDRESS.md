# How to Add Email Addresses to Form Configurations

This guide explains how to add additional email addresses to receive form submissions in the sandbox environment.

## Prerequisites

- PostgreSQL client tools installed (psql)
- AWS SSO access to sandbox account
- Database credentials from AWS Secrets Manager

## Option 1: Add Email to ALL Forms (Recommended)

This option adds a new email address to all forms at once. Both the original and new email addresses will receive form submissions.

### Step 1: Set Up Environment

Open PowerShell and configure the PostgreSQL path and password:

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"
$env:PGPASSWORD = 'A%:#SEtB=T{TNZ}1#STI*{7U#w_CfDz('
```

### Step 2: Update All Admin Emails

Replace `newperson@govtech.bb` with the actual email address you want to add:

```powershell
psql -h form-processor-database-sandbox-v1.c0t4mmww49vj.us-east-1.rds.amazonaws.com -p 5432 -U postgres -d form_processor_db -c "UPDATE form_configs SET value = 'laron.maughn@govtech.bb, newperson@govtech.bb' WHERE key = 'admin_email';"
```

### Step 3: Verify the Update

Check that all admin emails were updated:

```powershell
psql -h form-processor-database-sandbox-v1.c0t4mmww49vj.us-east-1.rds.amazonaws.com -p 5432 -U postgres -d form_processor_db -c "SELECT form_id, value FROM form_configs WHERE key = 'admin_email' ORDER BY form_id;"
```

You should see all forms now have both email addresses separated by a comma.

## Adding Multiple Email Addresses

AWS SES supports multiple recipients separated by commas. You can add as many as needed:

```sql
UPDATE form_configs 
SET value = 'laron.maughn@govtech.bb, person2@govtech.bb, person3@govtech.bb' 
WHERE key = 'admin_email';
```

## Example: Complete Workflow

```powershell
# 1. Set up environment
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"
$env:PGPASSWORD = 'A%:#SEtB=T{TNZ}1#STI*{7U#w_CfDz('

# 2. Add jane.doe@govtech.bb to all forms
psql -h form-processor-database-sandbox-v1.c0t4mmww49vj.us-east-1.rds.amazonaws.com -p 5432 -U postgres -d form_processor_db -c "UPDATE form_configs SET value = 'laron.maughn@govtech.bb, jane.doe@govtech.bb' WHERE key = 'admin_email';"

# 3. Verify the change
psql -h form-processor-database-sandbox-v1.c0t4mmww49vj.us-east-1.rds.amazonaws.com -p 5432 -U postgres -d form_processor_db -c "SELECT COUNT(*) as updated_forms FROM form_configs WHERE key = 'admin_email' AND value LIKE '%jane.doe@govtech.bb%';"
```

Expected output:
```
 updated_forms 
---------------
            19
(1 row)
```

## Troubleshooting

### Password Authentication Failed

If you get authentication errors, retrieve the password from AWS Secrets Manager:

```powershell
aws sso login --profile InfrastructureAdmin-672203047922
aws secretsmanager get-secret-value --secret-id sandbox/database/password --profile InfrastructureAdmin-672203047922 --region us-east-1 --query SecretString --output text
```

### Connection Timeout

Ensure you're connected to the internet and can reach AWS resources. The RDS instance is publicly accessible.

### Verify Current Configuration

To see current email configurations before making changes:

```powershell
psql -h form-processor-database-sandbox-v1.c0t4mmww49vj.us-east-1.rds.amazonaws.com -p 5432 -U postgres -d form_processor_db -c "SELECT form_id, value FROM form_configs WHERE key = 'admin_email' ORDER BY form_id;"
```

## Removing an Email Address

To remove an email address, update the value to exclude it:

```powershell
psql -h form-processor-database-sandbox-v1.c0t4mmww49vj.us-east-1.rds.amazonaws.com -p 5432 -U postgres -d form_processor_db -c "UPDATE form_configs SET value = 'laron.maughn@govtech.bb' WHERE key = 'admin_email';"
```

## Notes

- Changes take effect immediately - no deployment required
- AWS SES will send the same email to all addresses in the comma-separated list
- Each recipient receives their own copy of the email
- Email addresses must be verified in AWS SES (sandbox environment requirement)
- For production, ensure all email addresses are from verified domains

## Related Files

- `seed-form-configs-sandbox.sql` - Initial seed script with default email
- `README-FORM-CONFIGS.md` - Complete form configuration documentation
- `query-form-config.ts` - TypeScript utility for querying configurations
