#!/bin/sh

# Docker entrypoint script for Matter Server
# This script ensures proper initialization of the container environment

set -e

# Function to handle graceful shutdown
cleanup() {
    echo "Shutting down Matter Server..."
    # Kill all child processes
    jobs -p | xargs -r kill
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGTERM SIGINT

# Ensure data directory exists with proper permissions
if [ ! -d "/app/data" ]; then
    echo "Creating data directory..."
    mkdir -p /app/data
fi

# Set proper permissions (matter user should own the data directory)
# This is important for token storage and other persistent files
if [ "$(stat -c %u /app/data)" != "1001" ]; then
    echo "Setting correct permissions for data directory..."
    # Note: This requires the container to run with sufficient privileges
    # or the host data directory should already have correct permissions
    chmod 755 /app/data || echo "Warning: Could not set data directory permissions"
fi

# Ensure .env file is readable
if [ -f "/app/.env" ]; then
    echo "Environment file found"
    chmod 644 /app/.env || echo "Warning: Could not set .env permissions"
else
    echo "Warning: No .env file found. Using environment variables or defaults."
fi

# Validate critical environment variables
if [ -z "$SESSION_SECRET" ] || [ "$SESSION_SECRET" = "default-secret-change-in-production" ]; then
    echo "Warning: SESSION_SECRET not set or using default value!"
    echo "Please set a secure SESSION_SECRET in your .env file"
fi

# Check if SmartThings configuration is present
if [ -z "$SMARTTHINGS_CLIENT_ID" ] || [ -z "$SMARTTHINGS_CLIENT_SECRET" ]; then
    echo "Warning: SmartThings credentials not configured"
    echo "The server will start but SmartThings integration will not work"
fi

# Print startup information
echo "Starting Matter Server..."
echo "- Admin interface will be available on port 3000"
echo "- Matter protocol will be available on port 5540"
echo "- Data directory: /app/data"
echo "- Process ID: $$"

# Execute the main command
exec "$@"