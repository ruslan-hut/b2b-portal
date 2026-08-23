# Comex B2B Portal - Deployment Guide

This directory contains documentation and configuration files for deploying the Comex B2B Portal application.

## Deployment Scenarios

The Comex application supports **two distinct deployment scenarios**, each optimized for different infrastructure setups:

| Scenario | Description | Use Case |
|----------|-------------|----------|
| **[Scenario 1: Server + Nginx](#scenario-1-server--nginx)** | Backend service + Nginx web server | Production servers, VPS, dedicated hosting |
| **[Scenario 2: Docker Monolith](#scenario-2-docker-monolith)** | Single Docker container with everything | Docker environments, cloud platforms, local development |

**Key Difference**: Who serves the frontend static files?
- **Scenario 1**: Nginx serves frontend, proxies API to backend
- **Scenario 2**: Backend serves both frontend and API

## Quick Start

### Scenario 1: Server + Nginx

For traditional server deployment with separate web server and backend service:

```bash
# 1. Deploy using GitHub Actions
git push origin master  # Triggers .github/workflows/deploy-b2b.yml

# 2. Setup Nginx on server (manual, one-time setup)
# See docs/deployment/nginx.md for detailed instructions
```

**Requirements**:
- Linux server (Ubuntu/Debian recommended)
- Nginx web server
- Systemd for service management
- GitHub Actions for automated deployment

**Documentation**: [Nginx Deployment](./nginx.md)

### Scenario 2: Docker Monolith

For containerized deployment:

```bash
# 1. Build and run with Docker Compose
docker-compose up -d

# 2. Or build Docker image manually
# IMPORTANT: Build for linux/amd64 platform for cloud deployment
docker buildx build --platform linux/amd64 -t comex-app -f Dockerfile --load .
docker run -p 8888:8888 comex-app

# Or if on linux/amd64 host:
docker build -t comex-app -f Dockerfile .
docker run -p 8888:8888 comex-app
```

**Platform Requirements**: When deploying to cloud platforms (DigitalOcean, AWS, etc.), you must build for `linux/amd64` architecture. Use `docker buildx build --platform linux/amd64` if building on macOS or Windows ARM systems.

**Requirements**:
- Docker Engine
- Docker Compose (optional, recommended)

**Documentation**: [Docker Deployment](./docker.md)

## Architecture Comparison

### Scenario 1: Server + Nginx

```
Internet
   │
   ▼
┌──────────────────────┐
│   Nginx (:80/:443)   │  ← Nginx serves frontend static files
│  - Serves Frontend   │  ← Nginx proxies /api/* to backend
│  - Proxies API       │
└──────────┬───────────┘
           │
           │ proxy_pass
           ▼
┌──────────────────────┐
│  Backend (:8888)     │  ← Go API service only
│  - API endpoints     │  ← Does NOT serve static files
│  - Business logic    │
│  - Database access   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   MySQL Database     │
└──────────────────────┘

Frontend Files: /var/www/b2b/current/
Backend Binary: /opt/comex/bin/comex-back
Config: SERVE_STATIC=false
```

**Advantages**:
- ✅ Nginx optimized for serving static files
- ✅ Can easily add caching, compression, rate limiting
- ✅ SSL/TLS termination at Nginx
- ✅ Can serve multiple applications from one server
- ✅ Separate scaling of frontend and backend

**Best For**:
- Production deployments
- High-traffic applications
- When you need advanced web server features

### Scenario 2: Docker Monolith

```
Internet
   │
   ▼
┌──────────────────────────────────────┐
│     Docker Container (:8888)         │
│  ┌────────────────────────────────┐  │
│  │  Go Backend                    │  │
│  │  - Serves /api/* (API)         │  │
│  │  - Serves /* (Frontend files)  │  │  ← Backend serves everything
│  │  - From ./static directory     │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Frontend (./static/)          │  │  ← Compiled into container
│  │  - index.html                  │  │
│  │  - Angular bundles             │  │
│  └────────────────────────────────┘  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│   MySQL Container                    │
│   (separate or managed DB)           │
└──────────────────────────────────────┘

Frontend Files: /app/static/ (inside container)
Backend Binary: /app/comex-back (inside container)
Config: SERVE_STATIC=true
```

**Advantages**:
- ✅ Single container deployment
- ✅ Easy to scale horizontally
- ✅ Perfect for cloud platforms (DigitalOcean App Platform, Heroku, etc.)
- ✅ Simplified deployment workflow
- ✅ Built-in health checks

**Best For**:
- Docker/Kubernetes environments
- Cloud platform deployments
- Development and testing
- Microservices architecture (when combined with proxy)

## Configuration Differences

The key configuration difference between scenarios:

| Configuration | Scenario 1 (Nginx) | Scenario 2 (Docker) |
|---------------|-------------------|---------------------|
| **Backend Config** | `SERVE_STATIC=false` | `SERVE_STATIC=true` |
| **Frontend API URL** | `/api/v1` (relative, default) | `/api/v1` (relative, default) |
| **Frontend Location** | `/var/www/b2b/current` | `/app/static` (container) |
| **Web Server** | Nginx | Go backend (chi router) |
| **Deployment Method** | GitHub Actions → SSH | Docker build → push |
| **Media directory** | `/var/lib/comex/media` (`MEDIA_DIR`) | `media_data` volume → `/app/media` |

**Note**: Both scenarios use relative `/api/v1` by default. Absolute URLs are only needed if API is on a different domain (not recommended).

### Partner Resources media directory

Uploaded partner documents (PDFs, images) are stored on disk under `MEDIA_DIR`
and referenced from the `content_files` table by storage key.

Three operational rules:

1. **Keep it outside the release directory.** On the Nginx scenario
   `/var/www/b2b/current` is a symlink swapped on every deploy — media placed
   under it is discarded on the next release. Use an absolute path such as
   `/var/lib/comex/media`, owned by the service user with mode `750`.
2. **Back it up with the database, not separately.** The rows and the bytes are
   only useful together: a database restore without the media directory leaves
   every download 404ing, and media without the database is a directory of
   hash-named files with no titles.
3. **Never serve it directly from the web server.** Downloads go through
   `/api/v1/content/files/{uid}` so access rules are applied per request. The
   supplied nginx config deliberately has no `location` block pointing at the
   media directory — legal registrations and RRP price lists are not public.

Sizing: `media.max_upload_mb` (default 50) caps a single file. The nginx config
allows 60 MB on the upload path so an over-size upload is rejected by the API
with a readable message rather than by nginx with a bare 413.

## Environment Variables

### Common Variables (Both Scenarios)

```bash
# Application
ENV=production                  # Environment: local, prod
PORT=8888                      # Backend port

# Database
DATABASE_HOST=localhost        # Database hostname
DATABASE_PORT=3306            # Database port
DATABASE_USER=comex_user      # Database username
DATABASE_PASSWORD=***         # Database password
DATABASE_NAME=comex_db        # Database name

# JWT Authentication
JWT_SECRET_KEY=***            # JWT secret (min 32 chars, REQUIRED)
```

### Scenario 1 Specific (Server + Nginx)

```bash
# Backend Configuration
SERVE_STATIC=false            # Backend does NOT serve frontend

# Frontend Build (GitHub Actions)
API_URL=/api/v1              # Default: Relative path (Nginx proxies /api/* to backend)
# Note: Absolute URLs only needed if API is on different domain (not recommended)
```

### Scenario 2 Specific (Docker)

```bash
# Backend Configuration
SERVE_STATIC=true             # Backend serves frontend from ./static

# Frontend Build
API_URL=/api/v1              # Relative path (same origin)
```

## Deployment Workflows

### Scenario 1: GitHub Actions Workflow

**File**: `.github/workflows/deploy-b2b.yml`

Automated deployment pipeline:
1. **Build Backend**: Compile Go binary
2. **Build Frontend**: Build Angular app with production config
3. **Generate Config**: Create backend config with `SERVE_STATIC=false`
4. **Deploy Backend**: Copy binary, config, migrations to `/opt/comex/`
5. **Deploy Frontend**: Copy static files to `/var/www/b2b/current`
6. **Restart Service**: Restart backend systemd service

**Trigger**: Push to `master` branch

**Manual Setup Required**:
- Configure Nginx (see [Nginx Deployment](./nginx.md))
- Setup systemd service for backend
- Configure GitHub secrets

### Scenario 2: Docker Workflow

**File**: `.github/workflows/deploy-standalone.yml`

Manual deployment workflow:
1. **Build Image**: Multi-stage Docker build
2. **Save Image**: Export to tar.gz
3. **Upload to Server**: SCP to deployment server
4. **Deploy**: Run deployment script via SSH

**Trigger**: Manual (workflow_dispatch)

**Automatic Deployment**:
```bash
docker-compose up -d
```

## Directory Structure

```
deployment/
├── README.md                    # This file
├── SCENARIOS.md                 # Detailed scenario comparison
├── nginx/
│   ├── comex.conf              # Nginx configuration template
│   └── README.md               # Nginx setup instructions
└── docker/
    └── README.md               # Docker deployment guide

.github/workflows/
├── deploy-b2b.yml                  # Scenario 1: Server deployment
├── deploy-standalone.yml       # Scenario 2: Docker deployment
└── frontend/.github/workflows/
    └── deploy-b2b.yml         # Frontend-only deployment

backend/
├── config.yml                  # Backend config template
└── comex-back.yml             # Backend config with env vars

Dockerfile                      # Docker image definition
docker-compose.yml             # Docker Compose for Scenario 2
docker-compose.monolith.yml    # Alternative compose file
```

## Choosing a Deployment Scenario

### Use Scenario 1 (Server + Nginx) if you:
- Have a traditional VPS or dedicated server
- Want maximum control over web server configuration
- Need advanced features (caching, rate limiting, SSL termination)
- Already use Nginx for other applications
- Want to scale frontend and backend independently

### Use Scenario 2 (Docker Monolith) if you:
- Deploy to Docker-based platforms (DigitalOcean App Platform, AWS ECS, etc.)
- Want simplified deployment and scaling
- Use Kubernetes or Docker Swarm
- Prefer containerized applications
- Want portable deployments across environments

## Switching Between Scenarios

You can switch between scenarios by changing environment variables:

### From Scenario 2 → Scenario 1

1. Deploy frontend to server: `/var/www/b2b/current`
2. Configure Nginx (see [Nginx Deployment](./nginx.md))
3. Change backend config: `SERVE_STATIC=false`
4. Restart backend service

### From Scenario 1 → Scenario 2

1. Build Docker image with frontend included
2. Set environment: `SERVE_STATIC=true`
3. Run Docker container
4. Stop Nginx (no longer needed)

## Testing Deployments

### Health Check

Both scenarios provide a health check endpoint:

```bash
# Scenario 1 (via Nginx)
curl https://b2b.portal.example/api/v1/health

# Scenario 2 (direct to container)
curl http://localhost:8888/api/v1/health
```

Expected response:
```json
{"status":"ok"}
```

### Static Files Debug

Check if static files are being served correctly:

```bash
# Scenario 1 (via Nginx)
curl https://b2b.portal.example/

# Scenario 2 (via backend)
curl http://localhost:8888/

# Backend debug endpoint (both scenarios)
curl http://localhost:8888/api/v1/debug/static
```

## Troubleshooting

### Frontend Not Loading

**Scenario 1**:
1. Check Nginx is serving `/var/www/b2b/current`
2. Verify frontend files exist: `ls /var/www/b2b/current/`
3. Check Nginx error log: `/var/log/nginx/comex_error.log`

**Scenario 2**:
1. Check backend config: `SERVE_STATIC=true`
2. Verify frontend in container: `docker exec comex-app ls /app/static/`
3. Check backend logs: `docker logs comex-app`

### API Requests Failing

**Scenario 1**:
1. Verify backend is running: `systemctl status comex.service`
2. Check Nginx proxy configuration
3. Test backend directly: `curl http://localhost:8888/api/v1/health`

**Scenario 2**:
1. Check container is running: `docker ps`
2. Verify port mapping: `8888:8888`
3. Check container logs: `docker logs comex-app`

### Frontend Using Wrong API URL (localhost:8888)

**Symptoms**: Browser console shows requests to `http://localhost:8888/api/v1/*` instead of relative `/api/v1`

**Cause**: Frontend was built with development environment file instead of production environment file.

**Fix**:

1. **Rebuild frontend correctly**:
   ```bash
   cd frontend
   
   # Set API_URL environment variable (optional, defaults to /api/v1)
   export API_URL="/api/v1"
   
   # Run set-env.js to update environment.prod.ts
   npm run set-env
   
   # Build for production (this will use environment.prod.ts)
   npm run build:prod
   ```

2. **Verify the build**:
   ```bash
   # Check the built main.js file contains '/api/v1' not 'localhost:8888'
   grep -r "localhost:8888" dist/comex-front/browser/ || echo "OK: No localhost found"
   grep -r "/api/v1" dist/comex-front/browser/ | head -1 || echo "WARNING: /api/v1 not found"
   ```

3. **Redeploy frontend** (Scenario 1):
   ```bash
   # On your server
   RELEASE_DIR="/var/www/b2b/releases/$(date +%Y%m%d_%H%M%S)"
   sudo mkdir -p "$RELEASE_DIR"
   sudo cp -r /path/to/dist/comex-front/browser/* "$RELEASE_DIR/"
   sudo ln -sfn "$RELEASE_DIR" /var/www/b2b/current
   sudo chown -R www-data:www-data /var/www/b2b/current
   ```

**Prevention**: Always use `npm run build:prod` which runs `set-env.js` before building, or use GitHub Actions workflow which handles this automatically.

### CORS Issues

- **Scenario 1**: Backend handles CORS (Nginx doesn't interfere)
- **Scenario 2**: Backend handles CORS directly

If you see CORS errors:
1. Check backend CORS middleware (api.go:72-90)
2. Verify API_URL in frontend matches deployment
3. Check browser console for specific CORS error

## Security Considerations

### Scenario 1 (Server + Nginx)
- ✅ Nginx handles SSL/TLS termination
- ✅ Rate limiting at Nginx level
- ✅ Backend not directly exposed
- ⚠️ Ensure Nginx config is secure

### Scenario 2 (Docker)
- ⚠️ Backend directly exposed (put behind reverse proxy in production)
- ✅ Container isolation
- ✅ Health checks built-in
- ⚠️ Use HTTPS proxy (Traefik, nginx proxy, cloud load balancer)

## Performance Considerations

### Scenario 1
- **Static Files**: Served by Nginx (highly optimized)
- **Caching**: Nginx handles caching headers
- **Compression**: Nginx gzip compression
- **SSL**: Nginx SSL termination

### Scenario 2
- **Static Files**: Served by Go http.FileServer (good performance)
- **Caching**: Basic HTTP caching headers
- **Compression**: Can add gzip middleware to Go
- **SSL**: Should terminate at proxy/load balancer

## Getting Help

For detailed instructions:
- **Nginx Setup**: [Nginx Deployment](./nginx.md)
- **Docker Setup**: [Docker Deployment](./docker.md)
- **Scenarios Comparison**: [Deployment Scenarios](./scenarios.md)
- **Backend Setup**: documented in the backend repository
- **Frontend Setup**: [Frontend Overview](../architecture/frontend-overview.md)

## Contributing

When modifying deployment configurations:
1. Update this documentation
2. Test both deployment scenarios
3. Update workflow files if needed
4. Document any breaking changes
