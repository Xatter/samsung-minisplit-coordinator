#!/bin/bash
# Build script for Raspberry Pi deployments with network issues

echo "Building Samsung Mini-Split Coordinator for Raspberry Pi..."
echo "This script builds locally to avoid Docker network timeout issues."
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install Node.js first."
    exit 1
fi

# Install dependencies locally
echo "Step 1: Installing dependencies locally..."
npm install --no-audit --verbose || {
    echo "Error: npm install failed. Trying with --force..."
    npm install --no-audit --force --verbose
}

# Build TypeScript
echo ""
echo "Step 2: Building TypeScript..."
npm run build || {
    echo "Error: Build failed"
    exit 1
}

# Now build Docker image
echo ""
echo "Step 3: Building Docker image with pre-built files..."
docker compose build

echo ""
echo "Build complete! You can now run: docker compose up"
echo "The Docker container will use the locally built files."