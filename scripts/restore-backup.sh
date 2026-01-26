#!/bin/bash

# Database Restore Script
# Usage: ./scripts/restore-backup.sh <backup_file.sql> [database_name]

if [ -z "$1" ]; then
    echo "Error: Backup file required"
    echo "Usage: ./scripts/restore-backup.sh <backup_file.sql> [database_name]"
    exit 1
fi

BACKUP_FILE="$1"
DB_NAME="${2:-money}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file '$BACKUP_FILE' not found"
    exit 1
fi

echo "Restoring database '$DB_NAME' from '$BACKUP_FILE'..."

# Restore using docker compose postgres container
docker compose exec -T postgres psql -U postgres "$DB_NAME" < "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Database restored successfully"
else
    echo "✗ Failed to restore database"
    exit 1
fi
