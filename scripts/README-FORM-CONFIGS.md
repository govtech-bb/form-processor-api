# Form Configuration Setup

This directory contains scripts for managing form configurations in the database.

## Files

- `seed-form-configs-sandbox.sql` - Sandbox environment configuration (test emails)
- `query-form-config.ts` - TypeScript script to query form configurations
- `run-query.sh` - Shell script to execute the query

## Sandbox Setup

### Step 1: Run the Seed Script in DBeaver

1. Open DBeaver and connect to sandbox database
2. Open `seed-form-configs-sandbox.sql`
3. Execute the entire script (Ctrl+Enter or click Execute)
4. Verify results with the query at the end

### Step 2: Verify Configuration

Run this query to see all configurations:

```sql
SELECT form_id, key, value, description 
FROM form_configs 
ORDER BY form_id, key;
```

### Step 3: Test Form Submission

1. Go to sandbox frontend: https://your-sandbox-url.com
2. Fill out a form (e.g., birth certificate)
3. Complete payment (use test card if in test mode)
4. Check email: laron.maughn@govtech.bb

## Adding More Recipients

To add additional dev/QA team members, update the email values:

```sql
UPDATE form_configs 
SET value = 'laron.maughn@govtech.bb,dev2@govtech.bb,qa@govtech.bb'
WHERE key = 'admin_email';
```

Multiple emails should be comma-separated.

## Production Setup

**DO NOT use the sandbox seed script in production!**

For production, create a separate seed script with real government email addresses:
- Birth certificates → registration@gov.bb
- Death certificates → registration@gov.bb
- etc.

## Troubleshooting

### Table doesn't exist
If you get "relation form_configs does not exist":
```bash
cd form-processor-api
npm run db:migrate
```

### Email not sending
Check App Runner logs:
```bash
aws logs tail /aws/apprunner/form-processor-api-sandbox-v1 --follow
```

### Configuration not taking effect
The system caches nothing - changes are immediate. If emails still go to wrong address:
1. Verify the form_id matches exactly (check form schema JSON files)
2. Check for typos in the key name (must be 'admin_email')
3. Restart App Runner service if needed
