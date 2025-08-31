# Multi-stage build for Matter Server
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
# Use npm install instead of npm ci for better compatibility on ARM/Pi
# Set npm config for better performance on resource-constrained systems
RUN npm config set fetch-retry-maxtimeout 300000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm install --no-optional --timeout=300000

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

# Install only production dependencies
# Use npm install for better ARM/Pi compatibility and add timeout/retry logic
RUN npm install --omit=dev --no-optional --timeout=300000 || \
    (npm cache clean --force && npm install --omit=dev --no-optional --timeout=300000) && \
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