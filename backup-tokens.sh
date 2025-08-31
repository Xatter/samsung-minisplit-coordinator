#!/bin/bash
# Backup script for SmartThings tokens and state

BACKUP_DIR="$HOME/matter-server-backups"
DATA_DIR="$HOME/samsung-minisplit-coordinator/data"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup data directory
if [ -d "$DATA_DIR" ]; then
    tar -czf "$BACKUP_DIR/matter-data-$TIMESTAMP.tar.gz" -C "$DATA_DIR" .
    echo "Backup created: $BACKUP_DIR/matter-data-$TIMESTAMP.tar.gz"
    
    # Keep only last 5 backups
    ls -t "$BACKUP_DIR"/matter-data-*.tar.gz | tail -n +6 | xargs -r rm
    echo "Old backups cleaned (keeping last 5)"
else
    echo "Data directory not found: $DATA_DIR"
fi

# Show current backups
echo ""
echo "Current backups:"
ls -lh "$BACKUP_DIR"/matter-data-*.tar.gz 2>/dev/null || echo "No backups found"