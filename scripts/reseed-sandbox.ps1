# Quick script to re-seed sandbox database after teardown/rebuild
# Usage: .\reseed-sandbox.ps1

Write-Host "Re-seeding sandbox database..." -ForegroundColor Cyan

# Set up environment
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"

# Get password from AWS Secrets Manager
Write-Host "Retrieving database password from AWS Secrets Manager..." -ForegroundColor Yellow
$password = aws secretsmanager get-secret-value --secret-id sandbox/database/password --profile InfrastructureAdmin-672203047922 --region us-east-1 --query SecretString --output text

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to retrieve password. Make sure you're logged in with AWS SSO." -ForegroundColor Red
    Write-Host "Run: aws sso login --profile InfrastructureAdmin-672203047922" -ForegroundColor Yellow
    exit 1
}

$env:PGPASSWORD = $password

# Run seed script
Write-Host "Executing seed script..." -ForegroundColor Yellow
psql -h form-processor-database-sandbox-v1.c0t4mmww49vj.us-east-1.rds.amazonaws.com -p 5432 -U postgres -d form_processor_db -f "$PSScriptRoot\seed-form-configs-sandbox.sql"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSuccess! Database seeded with 25 configurations." -ForegroundColor Green
    
    # Verify
    Write-Host "`nVerifying..." -ForegroundColor Yellow
    psql -h form-processor-database-sandbox-v1.c0t4mmww49vj.us-east-1.rds.amazonaws.com -p 5432 -U postgres -d form_processor_db -c "SELECT COUNT(*) as total_configs, COUNT(DISTINCT form_id) as unique_forms FROM form_configs;"
} else {
    Write-Host "`nFailed to seed database. Check errors above." -ForegroundColor Red
    exit 1
}

Write-Host "`nDone! All form submissions will go to laron.maughn@govtech.bb" -ForegroundColor Green
