#!/bin/bash
# Restore script for SmartThings tokens and state

BACKUP_DIR="$HOME/matter-server-backups"
DATA_DIR="$HOME/samsung-minisplit-coordinator/data"

# Show available backups
echo "Available backups:"
ls -lh "$BACKUP_DIR"/matter-data-*.tar.gz 2>/dev/null || { echo "No backups found"; exit 1; }

# Get latest backup by default
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/matter-data-*.tar.gz 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "No backup files found"
    exit 1
fi

echo ""
echo "Latest backup: $LATEST_BACKUP"
echo "Do you want to restore this backup? (y/n)"
read -r response

if [ "$response" = "y" ]; then
    # Stop the service first
    echo "Stopping Matter Server..."
    docker compose down
    
    # Backup current data before restore
    if [ -d "$DATA_DIR" ]; then
        mv "$DATA_DIR" "$DATA_DIR.before-restore.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Create data directory
    mkdir -p "$DATA_DIR"
    
    # Restore backup
    tar -xzf "$LATEST_BACKUP" -C "$DATA_DIR"
    echo "Backup restored from: $LATEST_BACKUP"
    
    # Start the service
    echo "Starting Matter Server..."
    docker compose up -d
    
    echo "Restore complete!"
else
    echo "Restore cancelled"
fi