# Multi-stage build for Matter Server
# Use regular Debian-based Node image for better ARM compatibility
FROM node:22-bullseye AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set npm config for better Pi compatibility
RUN npm config set fetch-retry-maxtimeout 600000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set maxsockets 1

# Copy package files
COPY package*.json ./

# Use a simpler, more reliable npm install approach
RUN npm install --verbose

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-bullseye-slim AS production

# Create app directory
WORKDIR /app

# Skip user creation for Pi deployment simplicity
# (For production deployments, consider adding non-root user)

# Copy package files
COPY package*.json ./

# Set npm config for production install
RUN npm config set fetch-retry-maxtimeout 600000 && \
    npm config set maxsockets 1

# Install production dependencies
RUN npm install --omit=dev --verbose && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy static assets and views
COPY views ./views

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create data directory 
RUN mkdir -p /app/data

# Run as root for Pi deployment simplicity

# Expose ports
EXPOSE 3000 5540

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Use entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]