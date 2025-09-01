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

# Build backend
echo "Step 1: Installing backend dependencies locally..."
npm install --no-audit --verbose || {
    echo "Error: npm install failed. Trying with --force..."
    npm install --no-audit --force --verbose
}

echo ""
echo "Step 2: Building backend TypeScript..."
npm run build || {
    echo "Error: Backend build failed"
    exit 1
}

# Build frontend
echo ""
echo "Step 3: Installing frontend dependencies..."
cd frontend
npm install --no-audit --verbose || {
    echo "Error: Frontend npm install failed. Trying with --force..."
    npm install --no-audit --force --verbose
}

echo ""
echo "Step 4: Building React frontend..."
npm run build || {
    echo "Error: Frontend build failed"
    exit 1
}
cd ..

# Now build Docker image
echo ""
echo "Step 5: Building Docker image with pre-built files..."
docker build -f Dockerfile.pi -t samsung-minisplit-coordinator .

echo ""
echo "Build complete! You can now run: docker compose up"
echo "The Docker container will use the locally built files."