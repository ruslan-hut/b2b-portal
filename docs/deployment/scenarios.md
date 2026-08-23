# Deployment Scenarios - Detailed Comparison

This document provides an in-depth comparison of the two deployment scenarios for the Comex B2B Portal application.

## Table of Contents

- [Overview](#overview)
- [Scenario 1: Server + Nginx](#scenario-1-server--nginx)
- [Scenario 2: Docker Monolith](#scenario-2-docker-monolith)
- [Side-by-Side Comparison](#side-by-side-comparison)
- [Decision Matrix](#decision-matrix)
- [Migration Guide](#migration-guide)

---

## Overview

The Comex application can be deployed in two fundamentally different ways:

1. **Server + Nginx**: Traditional server deployment where Nginx serves the frontend and proxies API requests to a backend service
2. **Docker Monolith**: Containerized deployment where a single Go application serves both the frontend and API

Both scenarios use the **same codebase** but with different configuration settings.

### Frontend API Configuration

**Important**: The frontend in production mode **always uses relative URLs** (`/api/v1`) by default. This works seamlessly for both scenarios:

- **Scenario 1**: Nginx proxies `/api/*` requests to backend, so relative paths work automatically
- **Scenario 2**: Backend serves both frontend and API from same origin, so relative paths work automatically

The backend API is always available at `/api/v1` path. No configuration changes are needed for standard deployments - the default relative path works for both scenarios.

---

## Scenario 1: Server + Nginx

### Architecture Diagram

```
                                    ┌─────────────────────┐
                                    │   GitHub Actions    │
                                    │   (CI/CD Pipeline)  │
                                    └──────────┬──────────┘
                                               │
                   ┌───────────────────────────┴────────────────────────┐
                   │                                                     │
          Build Backend                                         Build Frontend
                   │                                                     │
                   ▼                                                     ▼
        ┌──────────────────────┐                           ┌──────────────────────┐
        │   Go Binary          │                           │   Angular Build      │
        │   comex-back         │                           │   (dist/browser/)    │
        └──────────┬───────────┘                           └──────────┬───────────┘
                   │                                                     │
                   │ Deploy via SSH                                     │ Deploy via SSH
                   │                                                     │
        ┌──────────▼───────────┐                           ┌──────────▼───────────┐
        │  Production Server   │                           │  Production Server   │
        │                      │                           │                      │
        │  /opt/comex/bin/     │                           │  /var/www/b2b/       │
        │    comex-back        │                           │    current/          │
        │                      │                           │                      │
        │  Systemd Service     │                           │  Static Files        │
        │  (comex.service)     │                           │                      │
        └──────────┬───────────┘                           └──────────┬───────────┘
                   │                                                     │
                   │                                                     │
                   │                      ┌──────────────────────────────┘
                   │                      │
                   └──────────────┬───────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │        Nginx             │
                    │     (:80 / :443)         │
                    │                          │
                    │  Location /api/* →       │
                    │    proxy to :8888        │
                    │                          │
                    │  Location /* →           │
                    │    serve from            │
                    │    /var/www/b2b/current  │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │       Internet           │
                    │   (b2b.portal.example)   │
                    └──────────────────────────┘
```

### Components

#### 1. Nginx Web Server
- **Port**: 80 (HTTP), 443 (HTTPS)
- **Responsibilities**:
  - Serve frontend static files from `/var/www/b2b/current`
  - Proxy API requests (`/api/*`) to backend service
  - SSL/TLS termination
  - HTTP caching and compression
  - Security headers
- **Configuration**: `/etc/nginx/sites-available/comex`

#### 2. Backend Go Service
- **Port**: 8888 (internal, not exposed)
- **Responsibilities**:
  - API endpoints only
  - Business logic
  - Database operations
  - JWT authentication
- **Location**: `/opt/comex/bin/comex-back`
- **Service**: Managed by systemd (`comex.service`)
- **Configuration**:
  - `SERVE_STATIC=false` (does NOT serve frontend)
  - `/opt/comex/config/config.yml`

#### 3. Frontend Static Files
- **Location**: `/var/www/b2b/current` (symlink to latest release)
- **Deployment**: GitHub Actions deploys to `/var/www/b2b/releases/{timestamp}`
- **Versioning**: Atomic deployments with rollback capability
- **Permissions**: Owned by `www-data:www-data`

#### 4. Database
- **Type**: MySQL
- **Connection**: Backend connects directly
- **Configuration**: Via environment variables or config file

### Request Flow

#### Frontend Request
```
Client Browser
    │
    │ GET https://b2b.portal.example/
    ▼
Nginx :443
    │
    │ try_files $uri $uri/ /index.html
    │
    │ Serve from /var/www/b2b/current/index.html
    ▼
Client receives HTML + JS bundles
```

#### API Request
```
Client Browser
    │
    │ POST https://b2b.portal.example/api/v1/auth/login
    ▼
Nginx :443
    │
    │ location /api/
    │ proxy_pass http://localhost:8888
    ▼
Backend :8888
    │
    │ Process request
    │ Query database
    │ Generate response
    ▼
Client receives JSON response
```

### Configuration Files

**Backend Config** (`/opt/comex/config/config.yml`):
```yaml
env: prod
listen:
  bind_ip: 127.0.0.1  # Only localhost (Nginx proxies)
  port: "8888"
serve_static: false   # Important: Nginx serves frontend
database:
  host: localhost
  port: "3306"
  # ... database credentials
jwt:
  secret_key: "..."   # From environment variable
admin:
  admin_token: ""     # Set ADMIN_TOKEN environment variable to enable admin API
client_api:
  key_pepper: ""      # CLIENT_API_KEY_PEPPER: required for the Client API
```

**Nginx Config** (`/etc/nginx/sites-available/comex`):
```nginx
server {
    listen 80;
    server_name b2b.portal.example;
    root /var/www/b2b/current;

    location /api/ {
        proxy_pass http://localhost:8888;
        # ... proxy headers
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Frontend Environment** (built with):
```typescript
export const environment = {
  production: true,
  apiUrl: '/api/v1',  // Default: Relative path (Nginx proxies /api/* to backend)
};
```

**Note**: The frontend always uses relative `/api/v1` by default. Nginx proxies `/api/*` requests to the backend service, so relative paths work seamlessly.

### Deployment Process

1. **Developer pushes to master branch**
2. **GitHub Actions workflow triggers**:
   - Build backend binary (Go)
   - Build frontend (Angular with `API_URL=/api/v1`)
   - Generate backend config with `SERVE_STATIC=false`
   - SSH to server
   - Deploy backend to `/opt/comex/`
   - Deploy frontend to `/var/www/b2b/releases/{timestamp}`
   - Update symlink: `/var/www/b2b/current` → latest release
   - Restart backend service
3. **Nginx automatically serves new frontend files**
4. **No Nginx reload needed** (static files updated in place)

### Advantages

✅ **Performance**:
- Nginx highly optimized for serving static files
- Can handle thousands of concurrent connections
- Built-in HTTP/2 support

✅ **Features**:
- Easy SSL/TLS setup (Let's Encrypt integration)
- Rate limiting and DDoS protection
- Advanced caching strategies
- Gzip compression out of the box

✅ **Scalability**:
- Frontend and backend can scale independently
- Multiple backends can be load-balanced by Nginx
- Can add CDN for static assets

✅ **Security**:
- Backend not directly exposed to internet
- Nginx provides additional security layer
- Easy to add WAF (Web Application Firewall)

✅ **Flexibility**:
- Can serve multiple applications from same server
- Can easily add additional domains/sites
- Can route different paths to different backends

### Disadvantages

❌ **Complexity**:
- Requires Nginx configuration and maintenance
- Two separate deployments (backend + frontend)
- More moving parts to monitor

❌ **Setup**:
- Manual Nginx setup required
- Need to configure systemd service
- Requires understanding of web server concepts

❌ **Maintenance**:
- Must maintain Nginx configuration
- SSL certificate renewal (even with Let's Encrypt)
- Log rotation for both Nginx and backend

### Best Use Cases

- ✅ Production deployments on VPS or dedicated servers
- ✅ High-traffic applications requiring performance
- ✅ When you need advanced web server features
- ✅ Serving multiple applications from one server
- ✅ When you already use Nginx for other services

---

## Scenario 2: Docker Monolith

### Architecture Diagram

```
                                ┌─────────────────────┐
                                │  Docker Build       │
                                │  Multi-stage        │
                                └──────────┬──────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        │                                      │
            Stage 1: Build Frontend          Stage 2: Build Backend
                        │                                      │
                        ▼                                      ▼
            ┌──────────────────────┐            ┌──────────────────────┐
            │  Node.js Image       │            │  Golang Image        │
            │  npm run build:prod  │            │  go build            │
            │  → dist/browser/     │            │  → comex-back        │
            └──────────┬───────────┘            └──────────┬───────────┘
                       │                                     │
                       └──────────────┬──────────────────────┘
                                      │
                          Stage 3: Runtime Image
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │     Alpine Linux             │
                       │                              │
                       │  /app/comex-back (binary)    │
                       │  /app/static/ (frontend)     │
                       │  /app/config.yml             │
                       │  /app/migrations/            │
                       │                              │
                       │  SERVE_STATIC=true           │
                       └──────────────┬───────────────┘
                                      │
                                      │ docker run -p 8888:8888
                                      ▼
                       ┌──────────────────────────────┐
                       │    Docker Container          │
                       │                              │
                       │  Go Backend :8888            │
                       │  ├─ Serves /api/* (API)      │
                       │  └─ Serves /* (Frontend)     │
                       │                              │
                       │  Frontend files in ./static  │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │  Docker Network              │
                       │                              │
                       │  MySQL Container :3306       │
                       └──────────────────────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │       Internet               │
                       │   (http://localhost:8888)    │
                       └──────────────────────────────┘
```

### Components

#### 1. Docker Container (comex-app)
- **Port**: 8888 (exposed to host)
- **Responsibilities**:
  - Serve API endpoints (`/api/*`)
  - Serve frontend static files (`/*`)
  - Business logic
  - Database operations
- **Base Image**: `alpine:latest`
- **Configuration**: `SERVE_STATIC=true`

#### 2. Frontend (Inside Container)
- **Location**: `/app/static/` (inside container)
- **Build**: Angular production build
- **Serving**: Go's `http.FileServer` with SPA fallback
- **Configuration**: `apiUrl: '/api/v1'` (relative path)

#### 3. Database Container
- **Image**: `mysql:8.0`
- **Port**: 3306
- **Network**: Docker bridge network
- **Data**: Persisted in Docker volume

### Request Flow

#### Frontend Request
```
Client Browser
    │
    │ GET http://localhost:8888/
    ▼
Docker Container :8888
    │
    │ Go Backend (chi router)
    │
    │ GET /* → http.FileServer
    │
    │ Serve from /app/static/index.html
    ▼
Client receives HTML + JS bundles
```

#### API Request
```
Client Browser
    │
    │ POST http://localhost:8888/api/v1/auth/login
    ▼
Docker Container :8888
    │
    │ Go Backend (chi router)
    │
    │ POST /api/v1/* → API handlers
    │
    │ Process request
    │ Query database (MySQL container)
    │ Generate response
    ▼
Client receives JSON response
```

### Configuration Files

**Dockerfile** (Multi-stage build):
```dockerfile
# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV API_URL=/api/v1
RUN npm run build:prod

# Stage 2: Build Backend
FROM golang:1.24-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -o comex-back main.go

# Stage 3: Runtime
FROM alpine:latest
WORKDIR /app
COPY --from=frontend-builder /app/frontend/dist/comex-front/browser ./static
COPY --from=backend-builder /app/backend/comex-back ./
COPY backend/config.yml ./
COPY backend/migrations ./migrations
EXPOSE 8888
CMD ["./comex-back", "-conf", "config.yml"]
```

**docker-compose.yml**:
```yaml
version: '3.8'
services:
  comex:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8888:8888"
    environment:
      - PORT=8888
      - SERVE_STATIC=true  # Important: Backend serves frontend
      - DATABASE_HOST=db
      - DATABASE_PORT=3306
      - DATABASE_USER=comex_user
      - DATABASE_PASSWORD=comex_password
      - DATABASE_NAME=comex_db
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - ADMIN_TOKEN=${ADMIN_TOKEN}  # Optional: Set to enable admin API
      - CLIENT_API_KEY_PEPPER=${CLIENT_API_KEY_PEPPER}  # Required for the Client API (openssl rand -hex 32)
    depends_on:
      - db

  db:
    image: mysql:8.0
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

**Backend Config** (in container):
```yaml
env: prod
listen:
  bind_ip: 0.0.0.0     # Listen on all interfaces
  port: "8888"
serve_static: true     # Important: Serve frontend from ./static
static_dir: ./static   # Frontend files location
database:
  host: db             # Docker network hostname
  port: "3306"
jwt:
  secret_key: "..."    # From environment variable
admin:
  admin_token: ""      # Set ADMIN_TOKEN environment variable to enable admin API
client_api:
  key_pepper: ""       # CLIENT_API_KEY_PEPPER: required for the Client API
```

**Frontend Environment** (built with):
```typescript
export const environment = {
  production: true,
  apiUrl: '/api/v1',   // Default: Relative path (same origin)
};
```

**Note**: The frontend always uses relative `/api/v1` by default in production. This works for both deployment scenarios without any configuration changes.

### Deployment Process

#### Local Development
```bash
# 1. Build and start
docker-compose up -d

# 2. View logs
docker-compose logs -f

# 3. Stop
docker-compose down
```

#### Production Deployment (Manual)
```bash
# 1. Build image
docker build -t comex-app:latest .

# 2. Save image
docker save comex-app:latest | gzip > comex-app.tar.gz

# 3. Copy to server
scp comex-app.tar.gz user@server:/opt/comex/

# 4. Load and run on server
ssh user@server
cd /opt/comex
docker load < comex-app.tar.gz
docker-compose up -d
```

#### Production Deployment (GitHub Actions)
```bash
# Trigger manual workflow
# GitHub Actions workflow (.github/workflows/deploy-standalone.yml):
# 1. Build Docker image
# 2. Save to tar.gz
# 3. Upload to server via SCP
# 4. Run deployment script via SSH
# 5. Load image and start containers
```

### Advantages

✅ **Simplicity**:
- Single container deployment
- No need to configure web server
- Fewer moving parts

✅ **Portability**:
- Same image runs anywhere (dev, staging, prod)
- Easy to move between cloud providers
- Works on any Docker-enabled platform

✅ **Scalability**:
- Easy horizontal scaling (run multiple containers)
- Built-in health checks
- Works well with orchestration (Kubernetes, Docker Swarm)

✅ **Development**:
- Consistent development and production environments
- Easy local testing
- Fast iteration

✅ **Cloud-Native**:
- Perfect for DigitalOcean App Platform, AWS ECS, Google Cloud Run
- Integrates with container registries
- Easy CI/CD integration

### Disadvantages

❌ **Performance**:
- Go's http.FileServer not as optimized as Nginx for static files
- No built-in HTTP/2 support (can add via Go)
- Less efficient caching strategies

❌ **Features**:
- No built-in rate limiting (must implement in Go)
- Limited compression options
- SSL/TLS must be handled by external proxy

❌ **Exposure**:
- Backend directly exposed (should use reverse proxy in production)
- No additional security layer
- Must implement all web server features in Go

❌ **Resource Usage**:
- Slightly higher memory usage (Go process + static files)
- Container overhead

### Best Use Cases

- ✅ Docker/Kubernetes deployments
- ✅ Cloud platform deployments (DigitalOcean, AWS, GCP)
- ✅ Development and testing environments
- ✅ Microservices architecture
- ✅ When you want simplified deployment
- ✅ When you need portability

---

## Side-by-Side Comparison

| Aspect | Scenario 1: Server + Nginx | Scenario 2: Docker Monolith |
|--------|---------------------------|----------------------------|
| **Architecture** | Nginx + Separate Backend | Single Container |
| **Web Server** | Nginx (external) | Go http.FileServer (built-in) |
| **Frontend Location** | `/var/www/b2b/current` | `/app/static` (in container) |
| **Backend Config** | `SERVE_STATIC=false` | `SERVE_STATIC=true` |
| **API Endpoint** | Via Nginx proxy | Direct |
| **SSL/TLS** | Nginx handles | External proxy needed |
| **Deployment** | GitHub Actions + SSH | Docker build/compose |
| **Complexity** | Higher | Lower |
| **Performance** | Better (Nginx optimized) | Good (Go is fast) |
| **Scalability** | Independent scaling | Container scaling |
| **Setup Time** | Longer (Nginx config) | Shorter (docker-compose up) |
| **Maintenance** | More (Nginx + Backend) | Less (single container) |
| **Portability** | Server-specific | Highly portable |
| **Best For** | Production VPS | Cloud platforms |
| **Resource Usage** | Lower (Nginx efficient) | Slightly higher |
| **Security Layer** | Nginx provides | Needs external proxy |
| **Caching** | Nginx (advanced) | Basic HTTP headers |
| **Compression** | Nginx gzip | Can add Go middleware |
| **Health Checks** | Custom monitoring | Built-in Docker |
| **Rollback** | Symlink switch | Image tag switch |
| **Local Dev** | Requires setup | `docker-compose up` |
| **CI/CD** | GitHub Actions (SSH) | GitHub Actions (Docker) |

---

## Decision Matrix

Use this matrix to decide which scenario fits your needs:

### Choose Scenario 1 (Server + Nginx) if:

| Question | Answer |
|----------|--------|
| Do you have a VPS or dedicated server? | ✅ Yes |
| Do you need maximum performance? | ✅ Yes |
| Do you need advanced caching/rate limiting? | ✅ Yes |
| Are you comfortable configuring Nginx? | ✅ Yes |
| Do you already use Nginx? | ✅ Yes |
| Do you want independent frontend/backend scaling? | ✅ Yes |
| Is this a production high-traffic application? | ✅ Yes |

### Choose Scenario 2 (Docker Monolith) if:

| Question | Answer |
|----------|--------|
| Do you deploy to cloud platforms? | ✅ Yes |
| Do you want simple deployment? | ✅ Yes |
| Do you use Docker/Kubernetes? | ✅ Yes |
| Do you need portability? | ✅ Yes |
| Is this for development/testing? | ✅ Yes |
| Do you want consistent dev/prod environments? | ✅ Yes |
| Do you need fast iteration? | ✅ Yes |

---

## Migration Guide

### From Scenario 2 to Scenario 1

**Prerequisites**:
- Server with root/sudo access
- Nginx installed
- Domain name pointing to server

**Steps**:

1. **Setup Nginx**:
   ```bash
   # Copy nginx config
   sudo cp deployment/nginx/comex.conf /etc/nginx/sites-available/comex

   # Update domain name
   sudo nano /etc/nginx/sites-available/comex

   # Enable site
   sudo ln -s /etc/nginx/sites-available/comex /etc/nginx/sites-enabled/

   # Test and reload
   sudo nginx -t
   sudo systemctl reload nginx
   ```

2. **Deploy Backend**:
   ```bash
   # Create directories
   sudo mkdir -p /opt/comex/{bin,config,migrations,logs}

   # Build backend
   cd backend
   go build -o comex-back main.go

   # Copy files
   sudo cp comex-back /opt/comex/bin/
   sudo cp config.yml /opt/comex/config/
   sudo cp -r migrations /opt/comex/

   # Update config: SERVE_STATIC=false
   sudo nano /opt/comex/config/config.yml
   ```

3. **Deploy Frontend**:
   ```bash
   # Create directories
   sudo mkdir -p /var/www/b2b/releases

   # Build frontend
   cd frontend
   npm run build:prod

   # Deploy
   RELEASE_DIR="/var/www/b2b/releases/$(date +%Y%m%d_%H%M%S)"
   sudo mkdir -p "$RELEASE_DIR"
   sudo cp -r dist/comex-front/browser/* "$RELEASE_DIR/"
   sudo ln -sfn "$RELEASE_DIR" /var/www/b2b/current

   # Set permissions
   sudo chown -R www-data:www-data /var/www/b2b
   sudo chmod -R 755 /var/www/b2b
   ```

4. **Setup Systemd Service** (optional but recommended):
   ```bash
   # Create service file
   sudo nano /etc/systemd/system/comex.service
   ```

   Add:
   ```ini
   [Unit]
   Description=Comex Backend Service
   After=network.target mysql.service

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/comex
   ExecStart=/opt/comex/bin/comex-back -conf /opt/comex/config/config.yml -log /opt/comex/logs
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```

   Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable comex.service
   sudo systemctl start comex.service
   ```

5. **Verify**:
   ```bash
   # Check backend
   curl http://localhost:8888/api/v1/health

   # Check frontend via Nginx
   curl http://your-domain.com/
   ```

### From Scenario 1 to Scenario 2

**Prerequisites**:
- Docker and Docker Compose installed
- Access to stop existing services

**Steps**:

1. **Stop Existing Services**:
   ```bash
   # Stop backend
   sudo systemctl stop comex.service

   # Disable Nginx site (optional)
   sudo rm /etc/nginx/sites-enabled/comex
   sudo systemctl reload nginx
   ```

2. **Build Docker Image**:
   ```bash
   # From project root
   docker build -t comex-app:latest -f Dockerfile .
   ```

3. **Configure Environment**:
   ```bash
   # Create .env file
   cat > .env << EOF
   PORT=8888
   ENV=production
   JWT_SECRET_KEY=your-secret-key-min-32-chars
   ADMIN_TOKEN=your-admin-token-here  # Optional: Set to enable admin API
   CLIENT_API_KEY_PEPPER=<openssl rand -hex 32>  # Required for the Client API
   DATABASE_HOST=db
   DATABASE_PORT=3306
   DATABASE_USER=comex_user
   DATABASE_PASSWORD=comex_password
   DATABASE_NAME=comex_db
   SERVE_STATIC=true
   EOF
   ```

4. **Start with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

5. **Verify**:
   ```bash
   # Check containers
   docker-compose ps

   # Check health
   curl http://localhost:8888/api/v1/health

   # Check frontend
   curl http://localhost:8888/
   ```

---

## Conclusion

Both deployment scenarios are fully supported and production-ready. The choice depends on your infrastructure, requirements, and preferences:

- **Server + Nginx**: Best for traditional hosting with maximum performance
- **Docker Monolith**: Best for cloud-native deployments with simplicity

The application codebase is identical - only the configuration differs (`SERVE_STATIC` flag). This allows you to easily switch between scenarios or even run both in different environments.
