#!/bin/bash

# Script to run the form config query
# Usage: ./scripts/run-query.sh

cd "$(dirname "$0")/.."

echo "Running form configuration query..."
echo ""

npx ts-node scripts/query-form-config.ts
