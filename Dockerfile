# Simplified Dockerfile for Raspberry Pi with network issues
# Assumes you've run 'npm install' and 'npm run build' locally first
FROM node:22-bullseye-slim

WORKDIR /app

# Copy everything (including node_modules and dist from local build)
COPY . .

# Create data directory 
RUN mkdir -p /app/data

# Copy and make entrypoint executable
RUN chmod +x /usr/local/bin/docker-entrypoint.sh || true

# Expose ports
EXPOSE 3000 5540

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Run the application directly
CMD ["node", "dist/server.js"]