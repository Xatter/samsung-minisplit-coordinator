# Multi-stage build for Matter Server  
FROM node:22-alpine AS builder

WORKDIR /app

# Set npm config for better Pi compatibility (remove deprecated unsafe-perm)
RUN npm config set fetch-retry-maxtimeout 600000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set maxsockets 1

# Try to install build dependencies, but don't fail if unavailable
RUN (apk update || echo "Package update failed") && \
    (apk add --no-cache python3 make g++ build-base || echo "Build tools installation failed, proceeding without native compilation support") || true

# Copy package files
COPY package*.json ./

# Install dependencies with fallback strategies for ARM/Pi
# Strategy 1: Try npm ci first (fastest if it works)
# Strategy 2: Try npm install with cache clear 
# Strategy 3: Try with --force flag as last resort
RUN npm ci --timeout=600000 --maxsockets=1 || \
    (npm cache clean --force && npm install --timeout=600000 --maxsockets=1) || \
    (npm cache clean --force && npm install --force --timeout=600000 --maxsockets=1)

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S matter && \
    adduser -S matter -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies with ARM/Pi optimizations
RUN npm ci --omit=dev --timeout=600000 --maxsockets=1 || \
    (npm cache clean --force && npm install --omit=dev --timeout=600000 --maxsockets=1) || \
    (npm cache clean --force && npm install --omit=dev --force --timeout=600000 --maxsockets=1) && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy static assets and views
COPY views ./views

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create data directory with proper permissions
RUN mkdir -p /app/data && \
    chown -R matter:matter /app

# Switch to non-root user
USER matter

# Expose ports
EXPOSE 3000 5540

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Use entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]