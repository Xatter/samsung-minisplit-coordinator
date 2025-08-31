# Docker Deployment Guide

This document provides instructions for deploying the Matter Server using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+
- A valid `.env` file with your configuration

## Quick Start

1. **Create your environment file**:
   ```bash
   cp .env.example .env
   # Edit .env with your SmartThings credentials and other settings
   ```

2. **Build and start the container**:
   ```bash
   docker-compose up -d
   ```

3. **View logs**:
   ```bash
   docker-compose logs -f matter-server
   ```

4. **Stop the container**:
   ```bash
   docker-compose down
   ```

## Configuration

### Environment Variables

The container requires a `.env` file with the following critical variables:

```env
# SmartThings Configuration (Required)
SMARTTHINGS_APP_ID=your-app-id-here
SMARTTHINGS_CLIENT_ID=your-client-id-here
SMARTTHINGS_CLIENT_SECRET=your-client-secret-here

# Security (Important)
SESSION_SECRET=your-secure-random-string-here

# Server URLs
SERVER_URL=http://your-server:3000
CALLBACK_URL=http://your-server:3000/auth/callback
```

### Volume Mounts

The Docker setup uses two critical volume mounts:

1. **Data Volume** (`./data:/app/data`):
   - Stores SmartThings OAuth tokens (encrypted)
   - Coordinator state and user preferences
   - **This data MUST persist between container restarts**

2. **Configuration Mount** (`./.env:/app/.env:ro`):
   - Provides environment configuration
   - Mounted as read-only

## Persistent Data

### What Gets Stored

The `/app/data` directory contains:

- `smartthings-tokens.json` - Encrypted OAuth tokens
- `coordinator-state.json` - Heat pump coordination state
- `user-preferences.json` - User configuration settings

### Backup Strategy

**Important**: Always backup the `data/` directory before upgrades:

```bash
# Create backup
tar -czf matter-server-backup-$(date +%Y%m%d).tar.gz data/

# Restore backup if needed
tar -xzf matter-server-backup-YYYYMMDD.tar.gz
```

## Deployment

### Production Deployment

1. **Create production environment**:
   ```bash
   # Create dedicated directory
   mkdir -p /opt/matter-server
   cd /opt/matter-server
   
   # Copy Docker files
   cp /path/to/source/{docker-compose.yml,Dockerfile,.dockerignore,docker-entrypoint.sh} .
   ```

2. **Configure environment**:
   ```bash
   # Create production .env
   nano .env
   # Set production URLs, secure SESSION_SECRET, etc.
   ```

3. **Build and deploy**:
   ```bash
   docker-compose up -d
   ```

### Upgrading

1. **Stop the current container**:
   ```bash
   docker-compose down
   ```

2. **Backup data**:
   ```bash
   tar -czf backup-$(date +%Y%m%d).tar.gz data/
   ```

3. **Pull new code and rebuild**:
   ```bash
   git pull  # or copy new files
   docker-compose build --no-cache
   ```

4. **Start with new image**:
   ```bash
   docker-compose up -d
   ```

5. **Verify functionality**:
   ```bash
   docker-compose logs -f matter-server
   curl http://localhost:3000/  # Check admin interface
   ```

## Networking

The container exposes:

- **Port 3000**: Admin web interface
- **Port 5540**: Matter protocol communication

For external access, ensure these ports are:
- Open in your firewall
- Properly forwarded if behind NAT
- Accessible to Matter controllers on your network

## Security Considerations

### Container Security

- Runs as non-root user (`matter:matter`)
- Uses Alpine Linux base for minimal attack surface
- Token files are encrypted at rest
- Proper file permissions enforced

### Network Security

- Consider using a reverse proxy (nginx, traefik) for HTTPS
- Restrict admin interface access using firewall rules
- Use strong SESSION_SECRET for session security

### File Permissions

The container expects the `data/` directory to be writable by UID 1001:

```bash
# Set correct permissions on host
sudo chown -R 1001:1001 data/
sudo chmod 755 data/
```

## Troubleshooting

### Common Issues

1. **Permission denied errors**:
   ```bash
   # Fix data directory permissions
   sudo chown -R 1001:1001 data/
   ```

2. **Container won't start**:
   ```bash
   # Check logs for details
   docker-compose logs matter-server
   
   # Verify .env file exists and is readable
   ls -la .env
   ```

3. **Token storage issues**:
   ```bash
   # Clear corrupted tokens (will require re-authentication)
   rm data/smartthings-tokens.json
   docker-compose restart matter-server
   ```

4. **Build failures**:
   ```bash
   # Clear build cache and rebuild
   docker-compose build --no-cache
   ```

### Health Checks

The container includes a health check that monitors the admin interface:

```bash
# Check container health
docker-compose ps
docker inspect matter-server | grep -A5 Health
```

### Monitoring

Monitor the application using:

```bash
# Real-time logs
docker-compose logs -f matter-server

# Container stats
docker stats matter-server

# Health status
docker-compose ps
```

## Advanced Configuration

### Using Named Volumes

For production deployments, consider using named volumes instead of bind mounts:

```yaml
# In docker-compose.yml
volumes:
  - matter-data:/app/data
  - matter-config:/app/.env:ro

volumes:
  matter-data:
    driver: local
  matter-config:
    driver: local
```

### Custom Network

To integrate with other services:

```yaml
networks:
  matter-network:
    external: true
    name: your-existing-network
```

### Resource Limits

Add resource constraints for production:

```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.25'
```

## Support

For issues related to Docker deployment:

1. Check container logs: `docker-compose logs -f matter-server`
2. Verify environment configuration
3. Ensure proper file permissions
4. Check network connectivity
5. Review this documentation for troubleshooting steps