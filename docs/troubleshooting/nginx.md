# Troubleshooting Nginx Deployment

## Issue: Backend Still Trying to Serve Static Files

### Symptoms

You see this warning in backend logs:
```
level=WARN msg="static directory not found, serving API only" dir=./static error="stat ./static: no such file or directory"
```

Even though your config file has `serve_static: false`.

### Root Cause

The `SERVE_STATIC` environment variable takes precedence over the config file value. If not set, the default value `true` (from `env-default` tag in code) may be used instead of the YAML value.

### Solution

**Set the `SERVE_STATIC=false` environment variable for the backend service.**

#### Method 1: Using Systemd Service File (Recommended)

1. **Copy the service file template**:
   ```bash
   sudo cp deployment/nginx/comex.service /etc/systemd/system/
   ```

2. **The template already includes the fix**:
   ```ini
   [Service]
   Environment="SERVE_STATIC=false"
   ```

3. **Reload and restart**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart comex.service
   ```

4. **Verify the fix**:
   ```bash
   sudo journalctl -u comex.service -n 50
   ```

   You should see:
   ```
   level=INFO msg="starting comex-back" serve_static=false
   level=INFO msg="static file serving disabled - frontend served by external web server (e.g., Nginx)"
   ```

#### Method 2: Export Environment Variable Before Running

If running the backend manually:

```bash
export SERVE_STATIC=false
/opt/comex/bin/comex-back -conf /opt/comex/config/config.yml -log /opt/comex/logs
```

#### Method 3: Set in systemd Override

If you have an existing service:

```bash
sudo systemctl edit comex.service
```

Add:
```ini
[Service]
Environment="SERVE_STATIC=false"
```

Save and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart comex.service
```

### Verification

After applying the fix, check the logs:

```bash
# View recent logs
sudo journalctl -u comex.service -n 50

# Follow logs in real-time
sudo journalctl -u comex.service -f
```

**Expected output on startup**:
```
time=2025-12-03T22:30:00.000Z level=INFO msg="starting comex-back" config=/opt/comex/config/config.yml env=prod serve_static=false
time=2025-12-03T22:30:00.001Z level=INFO msg="static file serving disabled - frontend served by external web server (e.g., Nginx)"
time=2025-12-03T22:30:00.002Z level=INFO msg="starting api server" mod=api.server address=127.0.0.1:8888
```

**You should NOT see**:
```
level=WARN msg="static directory not found, serving API only"
```

### Additional Verification

Test that only API endpoints work, not root path:

```bash
# API should work
curl http://localhost:8888/api/v1/health
# Response: {"status":"ok"}

# Root path should return 404 (no static files served)
curl http://localhost:8888/
# Response: 404 (expected - Nginx serves this)

# But accessing via Nginx should work
curl http://b2b.portal.example/
# Response: HTML content (Nginx serves frontend)
```

## Configuration Priority

The backend configuration follows this priority order:

1. **Environment variables** (highest priority)
   - `SERVE_STATIC=false` or `SERVE_STATIC=true`
2. **Config file values** (YAML)
   - `serve_static: false` in `config.yml`
3. **Default values** (lowest priority)
   - `env-default:"true"` in code

**Important**: Always set the environment variable in production to ensure the correct value is used, regardless of config file contents.

## Common Mistakes

### ❌ Mistake 1: Only Setting Config File Value
```yaml
# config.yml
serve_static: false  # This may be overridden by default!
```

**Problem**: Without the environment variable, the default `true` may be used.

### ✅ Correct: Set Environment Variable
```ini
# systemd service file
[Service]
Environment="SERVE_STATIC=false"
```

### ❌ Mistake 2: Wrong Boolean Format
```bash
# Wrong
export SERVE_STATIC="false"  # Quoted might not work
export SERVE_STATIC=False    # Capital F might not work
```

**Correct formats**:
```bash
export SERVE_STATIC=false    # Lowercase
export SERVE_STATIC=FALSE    # Uppercase (also works)
export SERVE_STATIC=0         # Number (also works)
```

### ❌ Mistake 3: Setting Variable Only in Shell
```bash
export SERVE_STATIC=false
sudo systemctl restart comex.service  # Variable NOT passed to service!
```

**Problem**: The environment variable is only in your shell, not in the systemd service.

**Correct**: Set in the service file itself.

## Quick Fix Commands

If you're experiencing this issue right now:

```bash
# 1. Stop the service
sudo systemctl stop comex.service

# 2. Edit the service file
sudo systemctl edit --full comex.service

# 3. Add this line in the [Service] section:
#    Environment="SERVE_STATIC=false"

# 4. Save and exit (Ctrl+X, Y, Enter in nano)

# 5. Reload systemd
sudo systemctl daemon-reload

# 6. Start the service
sudo systemctl start comex.service

# 7. Check logs
sudo journalctl -u comex.service -n 20 --no-pager | grep serve_static
```

Expected output:
```
serve_static=false
```

## Related Documentation

- [Nginx Setup Guide](../deployment/nginx.md)
- [Systemd Service Template](../../deployment/nginx/comex.service)
- [Deployment Scenarios](../deployment/scenarios.md)
