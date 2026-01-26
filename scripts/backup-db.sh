#!/bin/bash

# Database Backup Script
# Usage: ./scripts/backup-db.sh [database_name] [output_directory]

DB_NAME="${1:-money}"
OUTPUT_DIR="${2:-.}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$OUTPUT_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql"

echo "Creating backup of database '$DB_NAME'..."

# Create backup using docker compose postgres container
docker compose exec postgres pg_dump -U postgres "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Backup created successfully: $BACKUP_FILE"
    ls -lh "$BACKUP_FILE"
else
    echo "✗ Failed to create backup"
    exit 1
fi
