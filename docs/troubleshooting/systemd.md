# Systemd Service Troubleshooting Guide

## Quick Diagnosis

When your service shows `failed (Result: start-limit-hit)` with `code=exited, status=0/SUCCESS`, it means the application started but exited immediately. This is usually due to:

1. **JWT Secret Key not configured** (most common)
2. **Database connection failure**
3. **Configuration file path/permissions**
4. **Missing environment variables**

## Step-by-Step Troubleshooting

### 1. Check Application Logs

The most important step - check what error the application logged:

```bash
# View recent logs
sudo journalctl -u comex -n 100 --no-pager

# Follow logs in real-time (then restart service)
sudo journalctl -u comex -f
```

Look for error messages like:
- `"JWT secret key is not configured properly"`
- `"failed to initialize database"`
- `"failed to initialize repository"`
- `"server start"` errors

### 2. Verify Configuration File

```bash
# Check if config file exists and is readable
sudo cat /opt/comex/config/config.yml

# Check file permissions
ls -la /opt/comex/config/config.yml
```

**Common Issues:**
- Config file doesn't exist at `/opt/comex/config/config.yml`
- Config file has wrong permissions (should be readable by service user)
- JWT secret key is still set to default value `"change-me-in-production"`

### 3. Check JWT Secret Key

The application **requires** a JWT secret key that is:
- Not empty
- Not equal to `"change-me-in-production"`
- Not equal to `"change-me-in-production-min-32-chars"`
- Recommended: At least 32 characters long

**Fix JWT Secret Key:**

Option A: Set in config file (`/opt/comex/config/config.yml`):
```yaml
jwt:
  secret_key: "your-secure-secret-key-minimum-32-characters-long-for-production-use"
```

Option B: Set via systemd environment (recommended for production):
```bash
sudo systemctl edit comex.service
```

Add:
```ini
[Service]
Environment="JWT_SECRET_KEY=your-secure-secret-key-minimum-32-characters-long-for-production-use"
```

Then reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart comex
```

### 4. Verify Database Connection

```bash
# Check if database is running
sudo systemctl status mysql
# or
sudo systemctl status mariadb

# Test database connection manually
mysql -h localhost -u comex_user -p comex_db
```

**Check database configuration in config.yml:**
```bash
sudo cat /opt/comex/config/config.yml | grep -A 6 database
```

**Common Issues:**
- Database service not running
- Wrong database credentials
- Database doesn't exist
- Database user doesn't have permissions

### 5. Test Binary Manually

Run the binary directly to see the actual error:

```bash
# Test as current user
/opt/comex/bin/comex-back -conf=/opt/comex/config/config.yml -log=/var/log/

# Or test as the service user (if different)
sudo -u www-data /opt/comex/bin/comex-back -conf=/opt/comex/config/config.yml -log=/var/log/
```

This will show you the exact error message that systemd isn't displaying.

### 6. Check Systemd Service File

Verify your service file configuration:

```bash
sudo cat /etc/systemd/system/comex.service
```

**Expected service file format:**

```ini
[Unit]
Description=Comex: B2B Portal Backend
After=network.target mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/comex
ExecStart=/opt/comex/bin/comex-back -conf=/opt/comex/config/config.yml -log=/var/log/
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# Environment variables (optional, can also be in config.yml)
Environment="ENV=production"
Environment="PORT=8888"
Environment="DATABASE_HOST=localhost"
Environment="DATABASE_PORT=3306"
Environment="DATABASE_USER=comex_user"
Environment="DATABASE_PASSWORD=your_password"
Environment="DATABASE_NAME=comex_db"
Environment="JWT_SECRET_KEY=your-secure-secret-key-minimum-32-characters-long"

[Install]
WantedBy=multi-user.target
```

**Common Issues:**
- Wrong `ExecStart` path
- Missing `WorkingDirectory`
- Wrong `User`/`Group` permissions
- Missing `After=mysql.service` (service starts before database)

### 7. Check File Permissions

```bash
# Check binary permissions
ls -la /opt/comex/bin/comex-back
sudo chmod +x /opt/comex/bin/comex-back

# Check config directory permissions
ls -la /opt/comex/config/
sudo chmod 644 /opt/comex/config/config.yml

# Check log directory permissions
ls -la /var/log/comex/  # or wherever logs are stored
sudo mkdir -p /var/log/comex
sudo chown www-data:www-data /var/log/comex
```

### 8. Reset Start Limit

If systemd has hit the start limit, reset it:

```bash
# Reset failed state
sudo systemctl reset-failed comex

# Try starting again
sudo systemctl start comex

# Check status
sudo systemctl status comex
```

## Common Error Messages and Solutions

### Error: "JWT secret key is not configured properly"

**Solution:** Set a proper JWT secret key (see step 3 above)

### Error: "failed to initialize database"

**Solutions:**
1. Verify database is running: `sudo systemctl status mysql`
2. Check database credentials in config.yml
3. Test connection: `mysql -h localhost -u comex_user -p comex_db`
4. Ensure database exists: `CREATE DATABASE IF NOT EXISTS comex_db;`
5. Ensure user has permissions: `GRANT ALL ON comex_db.* TO 'comex_user'@'localhost';`

### Error: "failed to initialize repository"

**Solution:** Usually follows database initialization failure. Fix database connection first.

### Error: "server start" with network errors

**Solutions:**
1. Check if port is already in use: `sudo netstat -tlnp | grep 8888`
2. Check bind IP in config.yml (should be `0.0.0.0` for systemd service, not `127.0.0.1`)
3. Verify firewall allows the port: `sudo ufw status`

### Error: "no such file or directory"

**Solutions:**
1. Verify binary exists: `ls -la /opt/comex/bin/comex-back`
2. Verify config file exists: `ls -la /opt/comex/config/config.yml`
3. Check paths in systemd service file are correct

## Complete Service File Example

Here's a complete, production-ready systemd service file:

```ini
[Unit]
Description=Comex: B2B Portal Backend
Documentation=https://github.com/your-repo/comex
After=network.target mysql.service
Requires=mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/comex
ExecStart=/opt/comex/bin/comex-back -conf=/opt/comex/config/config.yml -log=/var/log/
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=comex

# Environment variables
Environment="ENV=production"
Environment="PORT=8888"

# Database (can also be in config.yml)
Environment="DATABASE_HOST=localhost"
Environment="DATABASE_PORT=3306"
Environment="DATABASE_USER=comex_user"
Environment="DATABASE_PASSWORD=secure_password_here"
Environment="DATABASE_NAME=comex_db"
Environment="DATABASE_DRIVER=mysql"

# JWT Secret (REQUIRED - must be set!)
Environment="JWT_SECRET_KEY=your-secure-secret-key-minimum-32-characters-long-for-production-use"

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log /opt/comex/logs

[Install]
WantedBy=multi-user.target
```

## Verification Steps

After fixing issues, verify everything works:

```bash
# 1. Start service
sudo systemctl start comex

# 2. Check status
sudo systemctl status comex

# 3. Check logs
sudo journalctl -u comex -f

# 4. Test API endpoint
curl http://localhost:8888/api/v1/health

# Expected response: {"status":"ok"}
```

## Still Having Issues?

1. **Check all logs:**
   ```bash
   sudo journalctl -u comex --since "1 hour ago" --no-pager
   ```

2. **Run binary manually with verbose output:**
   ```bash
   /opt/comex/bin/comex-back -conf=/opt/comex/config/config.yml -log=/var/log/ 2>&1 | tee /tmp/comex-debug.log
   ```

3. **Verify all paths and permissions:**
   ```bash
   sudo find /opt/comex -ls
   ```

4. **Check system resources:**
   ```bash
   free -h
   df -h
   ```

