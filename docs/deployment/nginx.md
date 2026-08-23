# Nginx Configuration for Comex B2B Portal

This directory contains the Nginx configuration for deploying Comex in **Scenario 1: Server Deployment with Nginx**.

## Architecture Overview

In this deployment scenario:

```
┌──────────┐         ┌─────────┐         ┌──────────────┐
│  Client  │ ──────> │  Nginx  │ ──────> │   Backend    │
│ Browser  │         │  :80/   │         │   :8888      │
└──────────┘         │  :443   │         │  (Go API)    │
                     └─────────┘         └──────────────�
                          │
                          │ (serves static files)
                          ▼
                     ┌─────────────────┐
                     │    Frontend     │
                     │ /var/www/b2b/   │
                     │    current      │
                     └─────────────────┘
```

- **Nginx**: Serves the frontend (Angular) and proxies API requests to the backend
- **Backend**: Go service running on port 8888, serves ONLY the API (no static files)
- **Frontend**: Static files deployed to `/var/www/b2b/current`

## Prerequisites

1. **Nginx installed** on your server:
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. **Backend service running** on port 8888
   - Backend should be configured with `SERVE_STATIC=false`

3. **Frontend deployed** to `/var/www/b2b/current`
   - Deployed via GitHub Actions workflow
   - See `.github/workflows/deploy-b2b.yml` for automated deployment

## Installation Steps

### 1. Copy Configuration File

Copy the Nginx configuration to your server:

```bash
# Copy to nginx sites-available directory
sudo cp deployment/nginx/comex.conf /etc/nginx/sites-available/comex

# Or if copying from your local machine to server:
scp deployment/nginx/comex.conf user@server:/tmp/
ssh user@server
sudo mv /tmp/comex.conf /etc/nginx/sites-available/comex
```

### 2. Update Configuration

Edit the configuration file and update these values:

```bash
sudo nano /etc/nginx/sites-available/comex
```

**Required changes:**
- `server_name`: Replace `b2b.portal.example` with your actual domain
- `root`: Verify path `/var/www/b2b/current` exists (created by deployment workflow)
- `proxy_pass`: Verify backend is running on `localhost:8888`

**Optional changes:**
- Enable HTTPS section if you have SSL certificates
- Update SSL certificate paths
- Adjust timeouts if needed
- Enable CORS headers if backend doesn't handle CORS

### 3. Create Frontend Directory

Ensure the frontend directory exists:

```bash
sudo mkdir -p /var/www/b2b/current
sudo chown -R www-data:www-data /var/www/b2b
sudo chmod -R 755 /var/www/b2b
```

**Note**: The GitHub Actions workflow will deploy frontend files to this location.

### 4. Enable the Site

Create a symbolic link to enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/comex /etc/nginx/sites-enabled/
```

### 5. Test Configuration

Always test the Nginx configuration before reloading:

```bash
sudo nginx -t
```

You should see:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 6. Reload Nginx

If the test is successful, reload Nginx:

```bash
sudo systemctl reload nginx
```

Or restart if needed:

```bash
sudo systemctl restart nginx
```

### 7. Verify Nginx is Running

Check Nginx status:

```bash
sudo systemctl status nginx
```

## SSL/TLS Configuration (HTTPS)

### Using Let's Encrypt (Recommended)

1. **Install Certbot**:
   ```bash
   sudo apt update
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Obtain Certificate**:
   ```bash
   sudo certbot --nginx -d b2b.portal.example
   ```

3. **Certbot will automatically**:
   - Obtain a certificate
   - Update your Nginx configuration
   - Set up automatic renewal

4. **Test automatic renewal**:
   ```bash
   sudo certbot renew --dry-run
   ```

### Using Custom SSL Certificates

If you have your own SSL certificates:

1. Copy certificates to the server:
   ```bash
   sudo cp your-cert.crt /etc/ssl/certs/comex.crt
   sudo cp your-cert.key /etc/ssl/private/comex.key
   sudo chmod 600 /etc/ssl/private/comex.key
   ```

2. Uncomment the HTTPS server block in `comex.conf`

3. Update certificate paths in the configuration

4. Test and reload Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

## Firewall Configuration

Ensure your firewall allows HTTP and HTTPS traffic:

```bash
# Using UFW (Ubuntu/Debian)
sudo ufw allow 'Nginx Full'
sudo ufw status

# Or manually allow ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Backend Service Configuration

The backend must be configured to **NOT serve static files** when using Nginx.

### Option 1: Environment Variable (Recommended)

Set the `SERVE_STATIC=false` environment variable in your systemd service file:

```bash
# Copy the service file template
sudo cp deployment/nginx/comex.service /etc/systemd/system/

# Edit if needed
sudo nano /etc/systemd/system/comex.service

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable comex.service
sudo systemctl start comex.service
```

The service file already includes `Environment="SERVE_STATIC=false"`.

### Option 2: Configuration File

Ensure your backend configuration has:

```yaml
# /opt/comex/config/config.yml
serve_static: false  # Important: Nginx serves static files
```

**Note**: Environment variables take precedence over config file values.

## Testing the Deployment

### 1. Test Frontend

Open your browser and navigate to your domain:
```
http://b2b.portal.example
```

You should see the Angular application.

### 2. Test Backend API

Test the API endpoint:
```bash
curl http://b2b.portal.example/api/v1/health
```

Expected response:
```json
{"status":"ok"}
```

### 3. Check Logs

Monitor Nginx logs for errors:

```bash
# Access log
sudo tail -f /var/log/nginx/comex_access.log

# Error log
sudo tail -f /var/log/nginx/comex_error.log
```

Monitor backend logs:
```bash
sudo journalctl -u comex.service -f
```

## Troubleshooting

### Frontend Not Loading

1. **Check frontend files exist**:
   ```bash
   ls -la /var/www/b2b/current/
   ```
   Should contain `index.html` and other Angular files.

2. **Check file permissions**:
   ```bash
   sudo chown -R www-data:www-data /var/www/b2b/current
   sudo chmod -R 755 /var/www/b2b/current
   ```

3. **Check Nginx error log**:
   ```bash
   sudo tail -50 /var/log/nginx/comex_error.log
   ```

### API Requests Failing (502 Bad Gateway)

1. **Verify backend is running**:
   ```bash
   sudo systemctl status comex.service
   curl http://localhost:8888/api/v1/health
   ```

2. **Check backend logs**:
   ```bash
   sudo journalctl -u comex.service -n 50
   ```

3. **Verify proxy_pass configuration**:
   ```bash
   grep proxy_pass /etc/nginx/sites-available/comex
   ```

### CORS Issues

If you see CORS errors (e.g., "No 'Access-Control-Allow-Origin' header is present"):

**Current Configuration**: Backend handles CORS via middleware

**To Fix**:

1. **Update systemd service** to set CORS environment variables:
   ```bash
   sudo nano /etc/systemd/system/comex.service
   ```

2. **Add CORS configuration** in the `[Service]` section:
   ```ini
   # CORS configuration - allow localhost for development and production domain
   Environment="CORS_ALLOWED_ORIGINS=http://localhost:4200,https://b2b.darkbyrior.com"
   Environment="CORS_ALLOW_CREDENTIALS=true"
   ```

3. **Reload systemd and restart service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart comex
   ```

4. **Verify CORS headers** are being sent:
   ```bash
   curl -I -H "Origin: http://localhost:4200" https://b2b.darkbyrior.com/api/v1/health
   # Should see: Access-Control-Allow-Origin: http://localhost:4200
   ```

**Alternative**: Use Nginx for CORS (not recommended, backend already handles it)
   - Uncomment CORS headers in nginx config
   - Remove CORS middleware from backend code

### 404 Errors for Angular Routes

If direct navigation to Angular routes (e.g., `/products/catalog`) gives 404:

1. **Verify `try_files` directive** in nginx config:
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }
   ```

2. This ensures all non-file requests fall back to `index.html` for SPA routing.

### SSL Certificate Issues

1. **Check certificate validity**:
   ```bash
   sudo certbot certificates
   ```

2. **Test SSL configuration**:
   ```bash
   openssl s_client -connect b2b.portal.example:443 -servername b2b.portal.example
   ```

3. **Check certificate renewal**:
   ```bash
   sudo certbot renew --dry-run
   ```

## Maintenance

### Updating Frontend

Frontend is updated automatically via GitHub Actions workflow.

After deployment, Nginx serves the new files immediately (no reload needed for static files).

### Updating Nginx Configuration

After modifying `/etc/nginx/sites-available/comex`:

```bash
# Test configuration
sudo nginx -t

# Reload Nginx (graceful, no downtime)
sudo systemctl reload nginx
```

### Monitoring

1. **Check Nginx status**:
   ```bash
   sudo systemctl status nginx
   ```

2. **Monitor access logs**:
   ```bash
   sudo tail -f /var/log/nginx/comex_access.log
   ```

3. **Monitor error logs**:
   ```bash
   sudo tail -f /var/log/nginx/comex_error.log
   ```

4. **Check Nginx processes**:
   ```bash
   ps aux | grep nginx
   ```

### Log Rotation

Nginx logs are automatically rotated by `logrotate`. Configuration is typically in:
```
/etc/logrotate.d/nginx
```

You can manually rotate logs:
```bash
sudo logrotate -f /etc/logrotate.d/nginx
```

## Security Best Practices

1. **Always use HTTPS in production**
2. **Keep Nginx updated**:
   ```bash
   sudo apt update
   sudo apt upgrade nginx
   ```

3. **Limit request size** (add to nginx config if needed):
   ```nginx
   client_max_body_size 10M;
   ```

4. **Rate limiting** (add to nginx config if needed):
   ```nginx
   limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

   location /api/ {
       limit_req zone=api burst=20;
       # ... rest of proxy config
   }
   ```

5. **Hide Nginx version**:
   ```nginx
   # In /etc/nginx/nginx.conf http block
   server_tokens off;
   ```

## Related Documentation

- [Deployment Overview](./overview.md)
- [Deployment Scenarios](./scenarios.md)
- [Frontend Deployment Workflow](../../.github/workflows/deploy-b2b.yml)
- **[Common Issues & Fixes](../troubleshooting/nginx.md)** - Troubleshooting guide

## Support

For issues or questions:
1. Check the **[Troubleshooting Guide](../troubleshooting/nginx.md)** for common issues
2. Review the [Troubleshooting](#troubleshooting) section above
3. Review backend logs from the systemd service.
4. Check GitHub Actions workflow logs
5. Consult Nginx documentation: https://nginx.org/en/docs/
