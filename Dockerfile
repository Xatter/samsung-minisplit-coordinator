# Multi-stage Dockerfile for Samsung Mini-Split Coordinator
# Stage 1: Build the React frontend
FROM node:22-bullseye-slim AS frontend-builder

WORKDIR /frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci --no-audit --no-fund

# Copy frontend source files
COPY frontend/ ./

# Build the React app
RUN npm run build

# Stage 2: Build the backend
FROM node:22-bullseye-slim AS backend-builder

WORKDIR /app

# Copy backend package files
COPY package*.json ./

# Install backend dependencies
RUN npm ci --no-audit --no-fund

# Copy backend source files
COPY tsconfig.json ./
COPY src/ ./src/
COPY views/ ./views/
COPY public/ ./public/

# Build the TypeScript backend
RUN npm run build

# Stage 3: Final runtime image
FROM node:22-bullseye-slim

# Install serve for the React frontend and pm2 for process management
RUN npm install -g serve pm2

WORKDIR /app

# Copy backend package files and install production dependencies only
COPY package*.json ./
RUN npm ci --production --no-audit --no-fund

# Copy built backend from builder stage
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/views ./views
COPY --from=backend-builder /app/public ./public

# Copy built frontend from builder stage
COPY --from=frontend-builder /frontend/dist ./frontend-dist

# Create data directory
RUN mkdir -p /app/data

# Create PM2 ecosystem file for running multiple processes
RUN cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'api-server',
      script: 'dist/web/api-server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'main-server',
      script: 'dist/server.js',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'frontend',
      script: 'serve',
      args: '-s frontend-dist -l 3000',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

# Expose ports
# 3000 - React frontend
# 3001 - API server
# 5540 - Matter protocol
EXPOSE 3000 3001 5540

# Health check for frontend
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start all services with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]