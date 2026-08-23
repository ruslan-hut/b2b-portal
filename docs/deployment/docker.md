# Docker Deployment Guide

This guide covers **Scenario 2: Docker Monolith Deployment** where the backend serves both the API and frontend static files from a single Docker container.

## Architecture Overview

```
┌──────────────────────────────────────┐
│     Docker Container (:8888)         │
│  ┌────────────────────────────────┐  │
│  │  Go Backend                    │  │
│  │  - Serves /api/* (API)         │  │
│  │  - Serves /* (Frontend files)  │  │
│  │  - From ./static directory     │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Frontend (./static/)          │  │
│  │  - index.html                  │  │
│  │  - Angular bundles             │  │
│  └────────────────────────────────┘  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│   MySQL Container (:3306)            │
└──────────────────────────────────────┘
```

## Quick Start

### Using Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone <repository-url>
cd comex

# 2. Create .env file with your configuration
cp .env.example .env
nano .env  # Edit with your settings

# 3. Build and start
docker-compose up -d

# 4. View logs
docker-compose logs -f

# 5. Access application
# Open http://localhost:8888 in your browser
```

### Using Docker Commands

```bash
# 1. Build the image for linux/amd64 (required for cloud deployment)
# If building on macOS/Windows ARM, use buildx:
docker buildx build --platform linux/amd64 -t comex-app:latest --load .

# Or if on linux/amd64 host:
docker build -t comex-app:latest .

# 2. Create a network
docker network create comex-network

# 3. Start MySQL
docker run -d \
  --name comex-db \
  --network comex-network \
  -e MYSQL_ROOT_PASSWORD=root_password \
  -e MYSQL_DATABASE=comex_db \
  -e MYSQL_USER=comex_user \
  -e MYSQL_PASSWORD=comex_password \
  -v comex_db_data:/var/lib/mysql \
  mysql:8.0

# 4. Start application
docker run -d \
  --name comex-app \
  --network comex-network \
  -p 8888:8888 \
  -e PORT=8888 \
  -e SERVE_STATIC=true \
  -e DATABASE_HOST=comex-db \
  -e DATABASE_PORT=3306 \
  -e DATABASE_USER=comex_user \
  -e DATABASE_PASSWORD=comex_password \
  -e DATABASE_NAME=comex_db \
  -e JWT_SECRET_KEY=your-secret-key-min-32-chars \
  comex-app:latest
```

## Environment Variables

### Required Variables

```bash
# JWT Configuration (REQUIRED)
JWT_SECRET_KEY=your-secret-key-min-32-chars  # Generate with: openssl rand -base64 32

# Database Configuration
DATABASE_HOST=db                  # Docker service name or hostname
DATABASE_PORT=3306
DATABASE_USER=comex_user
DATABASE_PASSWORD=your-db-password
DATABASE_NAME=comex_db
```

### Optional Variables

```bash
# Application
PORT=8888                         # Port to listen on (default: 8888)
ENV=production                    # Environment: local, prod

# Static File Serving (IMPORTANT for Docker deployment)
SERVE_STATIC=true                 # Backend serves frontend (must be true)
STATIC_DIR=./static               # Frontend files location (default: ./static)

# Frontend Build Arguments (set during Docker build)
APP_TITLE="B2B Portal"            # Application title
API_URL=/api/v1                   # API URL (relative path for Docker)

# Database (MySQL)
MYSQL_ROOT_PASSWORD=root_password # MySQL root password
```

## Configuration Files

### .env.example

Create a `.env` file based on this example:

```bash
# Application Configuration
PORT=8888
ENV=production

# JWT Configuration (REQUIRED - Generate with: openssl rand -base64 32)
JWT_SECRET_KEY=change-me-in-production-min-32-chars

# Database Configuration
DATABASE_HOST=db
DATABASE_PORT=3306
DATABASE_USER=comex_user
DATABASE_PASSWORD=comex_password
DATABASE_NAME=comex_db

# MySQL Root Password (for initial setup)
MYSQL_ROOT_PASSWORD=root_password

# Static File Serving (IMPORTANT: Must be true for Docker)
SERVE_STATIC=true
STATIC_DIR=./static
```

### docker-compose.yml

The repository includes a pre-configured `docker-compose.yml`:

```yaml
version: '3.8'

services:
  comex:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - APP_TITLE=B2B Portal
        - API_URL=/api/v1
    container_name: comex-app
    ports:
      - "8888:8888"
    environment:
      - PORT=8888
      - SERVE_STATIC=true      # Backend serves frontend
      - STATIC_DIR=./static
      - DATABASE_HOST=db
      # ... other environment variables
    depends_on:
      db:
        condition: service_healthy

  db:
    image: mysql:8.0
    container_name: comex-db
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_DATABASE=comex_db
      - MYSQL_USER=comex_user
      - MYSQL_PASSWORD=comex_password
    volumes:
      - db_data:/var/lib/mysql

volumes:
  db_data:
```

## Docker Commands Reference

### Building

#### Building for Linux/AMD64 Platform (Required for Cloud Deployment)

**Important**: If you're building on macOS (especially Apple Silicon) or Windows ARM, you must build for `linux/amd64` platform to ensure compatibility with cloud platforms like DigitalOcean App Platform, AWS, etc.

**Using docker buildx (Recommended):**

```bash
# Enable buildx if not already enabled
docker buildx create --use

# Build for linux/amd64 platform
docker buildx build --platform linux/amd64 -t comex-app:latest --load .

# Or with docker-compose
docker buildx build --platform linux/amd64 -f Dockerfile -t comex-app:latest --load .
```

**Using docker-compose with platform specification:**

```bash
# Build for linux/amd64 platform
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker-compose build

# Or add to docker-compose.yml:
# services:
#   comex:
#     platform: linux/amd64
```

**Standard Build (if on linux/amd64 host):**

```bash
# Build with default arguments
docker-compose build

# Build with custom arguments
docker-compose build --build-arg APP_TITLE="My App" --build-arg API_URL="/api/v1"

# Build without cache
docker-compose build --no-cache
```

**Note**: The Dockerfiles already include `--platform=linux/amd64` in each build stage, but you still need to use `docker buildx build --platform linux/amd64` when building to ensure the final image is for the correct architecture.

### Running

```bash
# Start in background
docker-compose up -d

# Start in foreground (see logs)
docker-compose up

# Start specific service
docker-compose up -d comex
```

### Viewing Logs

```bash
# Follow all logs
docker-compose logs -f

# Follow specific service
docker-compose logs -f comex

# View last 100 lines
docker-compose logs --tail=100

# View logs since timestamp
docker-compose logs --since 2024-01-01T00:00:00
```

### Managing Containers

```bash
# Stop all services
docker-compose down

# Stop but keep volumes
docker-compose down

# Stop and remove volumes (WARNING: deletes database data)
docker-compose down -v

# Restart services
docker-compose restart

# Restart specific service
docker-compose restart comex
```

### Inspecting

```bash
# View running containers
docker-compose ps

# View container details
docker inspect comex-app

# Execute command in container
docker-compose exec comex sh

# View resource usage
docker stats comex-app
```

## Health Checks

The application includes built-in health checks:

```bash
# Check health endpoint
curl http://localhost:8888/api/v1/health

# Expected response:
# {"status":"ok"}

# Check Docker health status
docker inspect --format='{{.State.Health.Status}}' comex-app
```

## Deployment to Production

### Cloud Platforms

#### DigitalOcean App Platform

1. **Push image to registry**:
   ```bash
   docker tag comex-app registry.digitalocean.com/your-registry/comex-app
   docker push registry.digitalocean.com/your-registry/comex-app
   ```

2. **Create app** in DigitalOcean dashboard
3. **Set environment variables** in app settings
4. **Deploy**

#### AWS ECS / Google Cloud Run

Similar process - push to ECR/GCR and configure service.

### Using GitHub Actions

The repository includes `.github/workflows/deploy-standalone.yml` for automated deployment:

```bash
# Trigger manual deployment
# Go to Actions tab in GitHub → Deploy to Standalone Server → Run workflow
```

## Updating the Application

### Update Code

```bash
# 1. Pull latest code
git pull origin master

# 2. Rebuild and restart
docker-compose up -d --build
```

### Update Database Schema

```bash
# Database migrations are applied automatically on startup
# Just restart the container after updating migrations
docker-compose restart comex
```

## Backup and Restore

### Database Backup

```bash
# Create backup
docker-compose exec db mysqldump -u root -p comex_db > backup_$(date +%Y%m%d).sql

# Or using Docker directly
docker exec comex-db mysqldump -u comex_user -pcomex_password comex_db > backup.sql
```

### Database Restore

```bash
# Restore from backup
docker-compose exec -T db mysql -u root -p comex_db < backup_20240101.sql

# Or using Docker directly
docker exec -i comex-db mysql -u comex_user -pcomex_password comex_db < backup.sql
```

### Volume Backup

```bash
# Backup database volume
docker run --rm -v comex_db_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/db_backup_$(date +%Y%m%d).tar.gz /data

# Restore database volume
docker run --rm -v comex_db_data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/db_backup_20240101.tar.gz -C /
```

## Troubleshooting

### Architecture Mismatch Error (Cloud Deployment)

**Error**: `container image mismatch with platform architecture (linux/amd64)`

**Cause**: Image was built for wrong architecture (e.g., ARM64 on macOS instead of linux/amd64).

**Solution**:
```bash
# Rebuild for linux/amd64 platform
docker buildx build --platform linux/amd64 -t comex-app:latest --load .

# Then push to registry
docker tag comex-app:latest YOUR_REGISTRY/comex-app:latest
docker push YOUR_REGISTRY/comex-app:latest
```

**Prevention**: Always use `docker buildx build --platform linux/amd64` when building for cloud platforms.

### Application Not Starting

1. **Check logs**:
   ```bash
   docker-compose logs comex
   ```

2. **Common issues**:
   - JWT_SECRET_KEY not set or too short
   - Database connection failed
   - Port already in use

### Database Connection Issues

1. **Verify database is running**:
   ```bash
   docker-compose ps db
   ```

2. **Check database logs**:
   ```bash
   docker-compose logs db
   ```

3. **Test connection**:
   ```bash
   docker-compose exec comex sh
   nc -zv db 3306
   ```

### Frontend Not Loading

1. **Check SERVE_STATIC is true**:
   ```bash
   docker-compose exec comex printenv | grep SERVE_STATIC
   ```

2. **Verify static files exist**:
   ```bash
   docker-compose exec comex ls -la /app/static/
   ```

3. **Check debug endpoint**:
   ```bash
   curl http://localhost:8888/api/v1/debug/static
   ```

### Port Already in Use

```bash
# Find process using port 8888
lsof -i :8888

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "8889:8888"  # Use different host port
```

### Out of Disk Space

```bash
# Clean up unused Docker resources
docker system prune -a

# Remove old images
docker image prune -a

# Remove old volumes (WARNING: includes data)
docker volume prune
```

## Performance Tuning

### Resource Limits

Add to `docker-compose.yml`:

```yaml
services:
  comex:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Database Optimization

```yaml
services:
  db:
    command:
      - --max_connections=200
      - --innodb_buffer_pool_size=1G
      - --innodb_log_file_size=256M
```

## Security Best Practices

1. **Use secrets for sensitive data**:
   ```yaml
   services:
     comex:
       secrets:
         - jwt_secret
         - db_password

   secrets:
     jwt_secret:
       external: true
     db_password:
       external: true
   ```

2. **Don't expose database port**:
   ```yaml
   services:
     db:
       ports: []  # Remove port mapping
   ```

3. **Use HTTPS proxy** in production:
   - Deploy behind Traefik, nginx-proxy, or cloud load balancer
   - Don't expose port 8888 directly to internet

4. **Regular updates**:
   ```bash
   # Update base images
   docker-compose pull
   docker-compose up -d
   ```

## Monitoring

### Docker Stats

```bash
# Real-time stats
docker stats comex-app comex-db

# One-time snapshot
docker stats --no-stream
```

### Application Logs

```bash
# Application writes logs to /app/logs
docker-compose exec comex ls -la /app/logs/

# View logs
docker-compose exec comex tail -f /app/logs/app.log
```

### Health Monitoring

Set up monitoring with:
- Prometheus + Grafana
- DataDog
- New Relic
- Cloud provider monitoring

## Related Documentation

- [Deployment Overview](../README.md)
- [Deployment Scenarios Comparison](./scenarios.md)
- [Nginx Deployment](./nginx.md)
- GitHub Actions workflow: `.github/workflows/deploy-standalone.yml` (backend repository)

## Support

For issues:
1. Check [Troubleshooting](#troubleshooting) section
2. Review container logs: `docker-compose logs`
3. Check GitHub Issues
4. Consult Docker documentation: https://docs.docker.com/
