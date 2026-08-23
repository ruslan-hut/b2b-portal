# GitHub Actions Deployment Guide

This guide explains how to set up automated deployment using GitHub Actions to deploy the Comex application to a remote server.

## Overview

The GitHub Actions workflow (`.github/workflows/deploy-b2b.yml`) automatically:
1. Builds the Go backend binary
2. Builds the Angular frontend application
3. Deploys backend as a systemd service (`comex`)
4. Deploys frontend to `/var/www/b2b/current`

## Prerequisites

### Server Requirements

- Linux server with SSH access
- Systemd (for service management)
- MySQL/MariaDB database
- Nginx or Apache (for serving frontend)
- User with sudo privileges

### Server Setup

Before running the deployment, ensure your server has:

1. **MySQL/MariaDB installed and running**
   ```bash
   sudo systemctl status mysql
   ```

2. **Database created and configured**
   - Create database: `CREATE DATABASE comex_db;`
   - Create user with appropriate permissions
   - Run migrations manually if needed (or let the app handle them)

3. **Web server configured** (Nginx example)
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       root /var/www/b2b/current;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       location /api {
           proxy_pass http://localhost:8888;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## GitHub Secrets Configuration

**📖 For detailed secrets setup instructions, see [GitHub Secrets Setup Guide](./github-secrets.md)**

The deployment workflow automatically generates `config.yml` from GitHub secrets. Configure the following secrets:

### Required Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `SSH_PRIVATE_KEY` | Private SSH key for server access | Contents of `~/.ssh/id_rsa` |
| `SSH_HOST` | Server hostname or IP address | `192.168.1.100` or `server.example.com` |
| `SSH_USER` | SSH username | `deploy` or `ubuntu` |
| `JWT_SECRET_KEY` | JWT secret key (min 32 chars) | Generate with `openssl rand -base64 32` |
| `ADMIN_TOKEN` | Admin API token (optional) | Generate with `openssl rand -hex 32` |
| `CLIENT_API_KEY_PEPPER` | Client API key pepper (required for `/api/client/v1`; rotating it invalidates all client keys) | Generate with `openssl rand -hex 32` |
| `DATABASE_USER` | Database username | `comex_user` |
| `DATABASE_PASSWORD` | Database password | Strong password |
| `DATABASE_NAME` | Database name | `comex_db` |

### Optional Secrets/Variables

| Secret/Variable | Description | Default |
|-----------------|-------------|---------|
| `DATABASE_HOST` | Database hostname | `localhost` |
| `DATABASE_PORT` | Database port | `3306` |
| `DATABASE_DRIVER` | Database driver | `mysql` |
| `LISTEN_BIND_IP` | Server bind IP | `0.0.0.0` |
| `LISTEN_PORT` | Server port | `8888` |
| `LISTEN_API_KEY` | API key for service calls | `your-api-key` |
| `TELEGRAM_ENABLED` | Enable Telegram bot | `false` |
| `TELEGRAM_API_KEY` | Telegram bot API key | - |
| `TELEGRAM_ADMIN_ID` | Telegram admin user ID | - |
| `TELEGRAM_BOT_NAME` | Telegram bot name | `Comex Bot` |
| `ADMIN_TOKEN` | Admin API token (optional) | Generate with `openssl rand -hex 32` |
| `LOGGING_DATABASE_ENABLED` | Enable database logging | `true` |
| `LOGGING_DATABASE_RETENTION_DAYS` | Log retention period (days) | `90` |
| `LOGGING_DATABASE_BATCH_SIZE` | Log batch size | `100` |
| `LOGGING_DATABASE_FLUSH_INTERVAL` | Log flush interval | `5s` |
| `API_URL` | Backend API URL for frontend | `https://api.portal.example/api/v1` |
| `APP_TITLE` | Application title | `B2B Portal` |

**Note**: 
- Secrets are used for sensitive data (passwords, keys)
- Variables can be used for non-sensitive configuration
- The workflow validates required secrets before deployment
- Config file is generated automatically from secrets during deployment

## SSH Key Setup

### Generate SSH Key Pair

```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy
```

### Add Public Key to Server

```bash
# Copy public key to server
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub user@your-server

# Or manually:
cat ~/.ssh/github_actions_deploy.pub | ssh user@your-server "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### Add Private Key to GitHub Secrets

```bash
# Copy the private key content
cat ~/.ssh/github_actions_deploy

# Paste the entire output (including -----BEGIN and -----END lines) into GitHub Secret: SSH_PRIVATE_KEY
```

## Deployment Structure

### Backend Deployment

The backend is deployed to `/opt/comex/`:

```
/opt/comex/
├── bin/
│   └── comex-back          # Executable binary
├── config/
│   └── config.yml          # Configuration file
├── migrations/
│   └── *.sql               # Database migrations
└── logs/                   # Application logs
```

**Systemd Service**: `comex.service`
- Service file: `/etc/systemd/system/comex.service`
- Status: `sudo systemctl status comex`
- Logs: `sudo journalctl -u comex -f`

### Frontend Deployment

The frontend uses a release-based deployment structure:

```
/var/www/b2b/
├── releases/
│   ├── 20240101_120000/    # Timestamped releases
│   ├── 20240101_130000/
│   └── ...
└── current -> releases/20240101_130000/  # Symlink to latest
```

- Only the last 5 releases are kept
- The `current` symlink points to the latest release
- Web server should serve from `/var/www/b2b/current`

## Configuration

### Backend Configuration

The `config.yml` file is **automatically generated** from GitHub secrets during deployment. You don't need to manually edit it on the server.

**Configuration is managed via GitHub Secrets:**
- Database settings → `DATABASE_*` secrets
- JWT secret key → `JWT_SECRET_KEY` secret
- Server settings → `LISTEN_*` secrets
- Telegram bot → `TELEGRAM_*` secrets

**To change configuration:**
1. Update the secrets in GitHub (Settings → Secrets and variables → Actions)
2. Trigger a new deployment
3. The config file will be regenerated with new values

**Note**: The application also supports environment variables via systemd override (takes precedence over config file):

```bash
# Create systemd override (optional)
sudo systemctl edit comex.service

# Add environment variables:
[Service]
Environment="DATABASE_HOST=localhost"
Environment="DATABASE_PORT=3306"
Environment="DATABASE_USER=comex_user"
Environment="DATABASE_PASSWORD=secure_password"
Environment="DATABASE_NAME=comex_db"
Environment="JWT_SECRET_KEY=your-secure-secret-key-min-32-chars"
Environment="PORT=8888"
Environment="ENV=production"
Environment="LOGGING_DATABASE_ENABLED=true"
Environment="LOGGING_DATABASE_RETENTION_DAYS=90"
```

### Frontend Configuration

The frontend API URL is set during build via GitHub Variables/Secrets (`API_URL`).

To change it, update the GitHub Variable and redeploy.

## Deployment Process

### Automatic Deployment

Deployment is triggered automatically when you push to `master` or `main` branch:

```bash
git add .
git commit -m "Your changes"
git push origin master
```

### Manual Deployment

You can also trigger deployment manually:

1. Go to **Actions** tab in GitHub
2. Select **Deploy to Production Server** workflow
3. Click **Run workflow**
4. Select branch and click **Run workflow**

## Post-Deployment

### Verify Backend Service

```bash
# Check service status
sudo systemctl status comex

# View logs
sudo journalctl -u comex -f

# Test API endpoint
curl http://localhost:8888/api/v1/health
```

### Verify Frontend

```bash
# Check deployment
ls -la /var/www/b2b/current

# Check symlink
readlink -f /var/www/b2b/current

# Test frontend (if web server is configured)
curl http://localhost/
```

## Troubleshooting

### Backend Service Not Starting

1. **Check service status**:
   ```bash
   sudo systemctl status comex
   ```

2. **Check logs**:
   ```bash
   sudo journalctl -u comex -n 50
   ```

3. **Verify configuration**:
   ```bash
   sudo cat /opt/comex/config/config.yml
   ```

4. **Check permissions**:
   ```bash
   ls -la /opt/comex/bin/comex-back
   sudo chmod +x /opt/comex/bin/comex-back
   ```

5. **Test binary manually**:
   ```bash
   sudo -u $USER /opt/comex/bin/comex-back -conf /opt/comex/config/config.yml -log /opt/comex/logs
   ```

### Frontend Not Updating

1. **Check deployment directory**:
   ```bash
   ls -la /var/www/b2b/current
   ```

2. **Verify symlink**:
   ```bash
   readlink -f /var/www/b2b/current
   ```

3. **Check web server configuration**:
   ```bash
   sudo nginx -t  # For Nginx
   sudo systemctl reload nginx
   ```

4. **Check file permissions**:
   ```bash
   ls -la /var/www/b2b/current
   sudo chown -R www-data:www-data /var/www/b2b/current
   ```

### Database Connection Issues

1. **Verify database is running**:
   ```bash
   sudo systemctl status mysql
   ```

2. **Test database connection**:
   ```bash
   mysql -h localhost -u comex_user -p comex_db
   ```

3. **Check environment variables**:
   ```bash
   sudo systemctl show comex.service | grep Environment
   ```

4. **Verify config.yml**:
   ```bash
   sudo cat /opt/comex/config/config.yml | grep -A 5 database
   ```

### SSH Connection Issues

1. **Test SSH connection manually**:
   ```bash
   ssh -i ~/.ssh/github_actions_deploy user@your-server
   ```

2. **Verify SSH key in GitHub Secrets**:
   - Ensure the entire key (including headers) is copied
   - Check for extra spaces or newlines

3. **Check server SSH configuration**:
   ```bash
   sudo tail -f /var/log/auth.log  # On server
   ```

## Rollback

### Rollback Backend

```bash
# Stop service
sudo systemctl stop comex

# Restore backup binary
sudo cp /opt/comex/bin/comex-back.backup.* /opt/comex/bin/comex-back

# Restart service
sudo systemctl start comex
```

### Rollback Frontend

```bash
# List available releases
ls -lt /var/www/b2b/releases

# Update symlink to previous release
sudo rm /var/www/b2b/current
sudo ln -s /var/www/b2b/releases/20240101_120000 /var/www/b2b/current

# Reload web server
sudo systemctl reload nginx
```

## Security Considerations

1. **SSH Keys**: Use dedicated SSH keys for deployment, not your personal keys
2. **Secrets**: Never commit secrets to the repository
3. **Permissions**: Ensure proper file permissions on server
4. **Firewall**: Restrict SSH access to trusted IPs
5. **Database**: Use strong passwords and restrict database access
6. **JWT Secret**: Use a strong, random secret (32+ characters)
7. **HTTPS**: Configure SSL/TLS for production

## Monitoring

### Backend Monitoring

```bash
# Service status
sudo systemctl status comex

# Resource usage
sudo systemctl status comex | grep Memory

# Log monitoring
sudo journalctl -u comex -f
```

### Frontend Monitoring

- Monitor web server logs
- Check application logs for errors
- Monitor disk space for releases directory

## Support

For issues or questions:
1. Check GitHub Actions logs in the **Actions** tab
2. Review server logs
3. Verify configuration files
4. Test components individually

