#!/bin/bash
# Startup script for App Runner
# Runs migrations and seeding before starting the application

set -e  # Exit on error

echo "🚀 Starting application initialization..."

# Run migrations
echo "📦 Running database migrations..."
npm run db:migrate || {
    echo "❌ Migration failed, but continuing..."
}

# Seed form_configs if in sandbox environment
if [ "$ENVIRONMENT" = "sandbox" ]; then
    echo "🌱 Seeding sandbox configuration data..."
    
    # Check if psql is available (it won't be in App Runner, so we'll use TypeORM)
    # The SeedFormConfigsSandbox migration will handle this
    echo "✅ Sandbox seeding will be handled by migration"
fi

# Start the application
echo "✨ Starting NestJS application..."
exec npm run start:prod
