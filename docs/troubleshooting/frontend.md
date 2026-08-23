# Frontend Troubleshooting Guide

Comprehensive guide for diagnosing and fixing frontend issues in the Comex B2B Portal.

## Table of Contents

- [Quick Diagnosis](#quick-diagnosis)
- [Frontend Not Loading](#frontend-not-loading)
- [Build Issues](#build-issues)
- [API Connection Issues](#api-connection-issues)
- [Translation Issues](#translation-issues)
- [Authentication Issues](#authentication-issues)
- [Common Error Messages](#common-error-messages)

---

## Quick Diagnosis

### Frontend Not Loading

**Symptom**: Backend API works (`/api/v1/health` returns OK), but frontend is not accessible.

**Quick Checks**:
1. ✅ Verify `STATIC_DIR=./static` is set in environment variables
2. ✅ Check build logs - frontend build completed successfully
3. ✅ Verify static files exist in container/on server
4. ✅ Test accessing root path `/` - should return HTML

**Most Common Fix**: Missing `STATIC_DIR` environment variable (90% of cases)

---

## Frontend Not Loading

### Problem
Backend API is working (`/api/v1/health` returns OK), but frontend is not accessible.

### Quick Checks

#### 1. Verify Environment Variables

**For DigitalOcean App Platform:**
- Go to **Settings** → **App-Level Environment Variables**
- Ensure these are set:
  ```
  STATIC_DIR=./static
  PORT=8080
  ENV=production
  ```

**For Server + Nginx:**
- Frontend files should be in `/var/www/b2b/current`
- Nginx should be configured to serve from this directory
- See [Nginx Setup Guide](../deployment/nginx.md)

**Important**: `STATIC_DIR` must be set to `./static` (relative path from working directory)

#### 2. Check Build Logs

**DigitalOcean App Platform:**
1. Go to your app → **Runtime Logs** or **Build Logs**
2. Look for:
   - ✅ `npm run build:prod` completed successfully
   - ✅ `COPY --from=frontend-builder /app/frontend/dist/comex-front/browser ./static` succeeded
   - ❌ Any errors during frontend build

**GitHub Actions:**
1. Check Actions tab → Latest workflow run
2. Review build step logs
3. Look for Angular build errors

#### 3. Verify Static Files Exist

**Docker Deployment:**
```bash
# Check if static directory exists in container
docker exec comex-app ls -la /app/static

# Should see: index.html, main-*.js, styles-*.css, assets/
```

**Server Deployment:**
```bash
# Check frontend files
ls -la /var/www/b2b/current/

# Should see: index.html, main-*.js, styles-*.css, assets/
```

#### 4. Test Frontend Access

**Expected URLs:**
- Root: `https://your-app.ondigitalocean.app/` → Should return HTML
- Direct: `https://your-app.ondigitalocean.app/index.html` → Should return HTML

**If you get 404:**
- Static files are not being served
- Check `STATIC_DIR` environment variable
- Check build logs

### Common Issues and Solutions

#### Issue 1: STATIC_DIR Not Set

**Symptom**: API works, but accessing `/` returns 404 or API error

**Solution**:
1. Add `STATIC_DIR=./static` in environment variables
2. Redeploy the app

**For DigitalOcean:**
- Settings → App-Level Environment Variables → Add `STATIC_DIR=./static`

**For Docker:**
- Add to `docker-compose.yml` or `.env` file

#### Issue 2: Frontend Build Failed

**Symptom**: Build logs show npm errors or frontend build failed

**Common Causes**:
- Node.js version mismatch (should be 18+)
- Missing dependencies
- Build script errors
- TypeScript compilation errors

**Solution**:
1. Check build logs for specific errors
2. Verify Node.js version: `node --version` (should be 18+)
3. Reinstall dependencies: `cd frontend && npm ci`
4. Test build locally: `npm run build:prod`
5. Fix errors and redeploy

#### Issue 3: Static Files Not Copied

**Symptom**: Build succeeds but static directory is empty or missing

**Solution**:
1. Check Dockerfile line that copies frontend:
   ```dockerfile
   COPY --from=frontend-builder /app/frontend/dist/comex-front/browser ./static
   ```
2. Verify Angular build output path matches: `dist/comex-front/browser`
3. Check if `angular.json` output path changed
4. Verify build actually created files in expected location

#### Issue 4: Wrong Base Path

**Symptom**: Frontend loads but assets (CSS, JS) return 404

**Solution**:
- Frontend is configured with `baseHref: "/"` in `angular.json`
- Should be accessible at root path `/`
- If you need `/b2b/` path, update `angular.json` and rebuild

**Check angular.json:**
```json
{
  "projects": {
    "comex-front": {
      "architect": {
        "build": {
          "options": {
            "baseHref": "/"
          }
        }
      }
    }
  }
}
```

#### Issue 5: CORS or Routing Issues

**Symptom**: Frontend loads but API calls fail

**Solution**:
- Check browser console for CORS errors
- Verify `apiUrl` in frontend environment is `/api/v1` (relative path)
- Check API endpoint accessibility
- Verify backend CORS configuration allows your domain

---

## Build Issues

### Build Fails During Docker Build

**Symptoms**:
- Docker build fails at frontend build stage
- npm errors in build logs
- TypeScript compilation errors

**Solutions**:

1. **Check Node.js Version**:
   ```dockerfile
   # Dockerfile should use Node 18+
   FROM node:18-alpine AS frontend-builder
   ```

2. **Clear npm Cache**:
   ```bash
   # In Dockerfile, add before npm install:
   RUN npm cache clean --force
   ```

3. **Check Dependencies**:
   ```bash
   # Test locally first
   cd frontend
   npm ci
   npm run build:prod
   ```

4. **Check Disk Space**:
   - Docker build requires sufficient disk space
   - Check: `df -h`

### Build Succeeds But Files Missing

**Symptoms**:
- Build completes but `static/` directory is empty
- No `index.html` in output

**Solutions**:

1. **Verify Build Output Path**:
   ```bash
   # Check angular.json output path
   cat frontend/angular.json | grep outputPath
   ```

2. **Check Dockerfile COPY Command**:
   ```dockerfile
   # Should match Angular output path
   COPY --from=frontend-builder /app/frontend/dist/comex-front/browser ./static
   ```

3. **Test Build Locally**:
   ```bash
   cd frontend
   npm run build:prod
   ls -la dist/comex-front/browser/
   ```

---

## API Connection Issues

### Frontend Can't Connect to Backend

**Symptoms**:
- API calls fail with connection errors
- CORS errors in browser console
- Network errors in DevTools

**Solutions**:

1. **Check API URL Configuration**:
   ```typescript
   // frontend/src/environments/environment.prod.ts
   export const environment = {
     production: true,
     apiUrl: '/api/v1'  // Should be relative for same-origin
   };
   ```

2. **Verify Backend is Running**:
   ```bash
   # Test backend health
   curl http://localhost:8888/api/v1/health
   ```

3. **Check CORS Configuration**:
   - Backend should allow requests from frontend origin
   - Check backend CORS middleware configuration

4. **Check Network Tab**:
   - Open browser DevTools → Network tab
   - Look for failed requests
   - Check request URL and response

### API Returns 401 Unauthorized

**Symptoms**:
- Login works but subsequent API calls fail
- "Unauthorized" errors

**Solutions**:

1. **Check Token Storage**:
   ```javascript
   // Check localStorage
   localStorage.getItem('authToken')
   ```

2. **Verify Token Format**:
   - Token should be included as: `Authorization: Bearer <token>`
   - Check request headers in Network tab

3. **Check Token Expiration**:
   - Tokens expire after 15 minutes (default)
   - Implement token refresh logic

---

## Translation Issues

### Translation Keys Visible Instead of Text

**Symptoms**:
- Seeing keys like `common.welcome` instead of translated text
- Translations not loading

**Solutions**:

1. **Check Translation Files Exist**:
   ```bash
   ls -la frontend/src/assets/i18n/
   # Should see: en.json, uk.json
   ```

2. **Verify APP_INITIALIZER**:
   ```typescript
   // frontend/src/app/core/core.module.ts
   {
     provide: APP_INITIALIZER,
     useFactory: initializeTranslations,
     multi: true
   }
   ```

3. **Check Translation Service**:
   - Verify translations load before app bootstrap
   - Check browser console for 404 errors on translation files

4. **Verify Asset Paths**:
   ```typescript
   // Should use relative paths, not absolute
   'assets/i18n/en.json'  // ✅ Correct
   '/assets/i18n/en.json' // ❌ Wrong (breaks with custom base href)
   ```

### Translations Not Updating

**Symptoms**:
- Changes to translation files not reflected
- Old translations still showing

**Solutions**:

1. **Clear Browser Cache**:
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache

2. **Rebuild Frontend**:
   ```bash
   cd frontend
   npm run build:prod
   ```

3. **Check Translation File Format**:
   ```json
   {
     "common": {
       "welcome": "Welcome"
     }
   }
   ```

---

## Authentication Issues

### Login Not Working

**Symptoms**:
- Login form submits but nothing happens
- Error messages not showing
- Redirect not working

**Solutions**:

1. **Check Backend Connection**:
   ```bash
   # Test login endpoint
   curl -X POST http://localhost:8888/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "password": "password123"}'
   ```

2. **Check Browser Console**:
   - Open DevTools → Console
   - Look for JavaScript errors
   - Check Network tab for failed requests

3. **Verify Form Validation**:
   - Check form validation rules
   - Ensure required fields are filled

4. **Check Auth Service**:
   - Verify AuthService is making correct API calls
   - Check request/response format

### Token Not Persisting

**Symptoms**:
- Login succeeds but user logged out on refresh
- Token not saved to localStorage

**Solutions**:

1. **Check localStorage**:
   ```javascript
   // Should see:
   localStorage.getItem('authToken')
   localStorage.getItem('currentUser')
   ```

2. **Verify Token Storage Logic**:
   - Check AuthService saves token after login
   - Verify token is included in subsequent requests

3. **Check Browser Settings**:
   - Ensure cookies/localStorage are enabled
   - Check for privacy/incognito mode restrictions

---

## Common Error Messages

### "static directory not found, serving API only"

**Cause**: `STATIC_DIR` not set or static files not copied

**Solution**:
1. Set `STATIC_DIR=./static` in environment variables
2. Verify frontend build completed successfully
3. Check Dockerfile copies static files correctly

### "Translation file not found"

**Cause**: Translation files missing or wrong path

**Solution**:
1. Verify `assets/i18n/en.json` and `uk.json` exist
2. Check translation service uses relative paths
3. Rebuild frontend

### "CORS policy: No 'Access-Control-Allow-Origin' header"

**Cause**: Backend CORS not configured correctly

**Solution**:
1. Check backend CORS middleware
2. Verify allowed origins include frontend domain
3. Check CORS headers in response

### "Failed to fetch"

**Cause**: Network error or backend not accessible

**Solution**:
1. Verify backend is running
2. Check API URL is correct
3. Verify network connectivity
4. Check firewall rules

---

## Debugging Steps

### Step 1: Check Application Logs

**DigitalOcean:**
- Go to app → Runtime Logs
- Look for errors or warnings

**Server:**
```bash
# Check backend logs
sudo journalctl -u comex -f

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Step 2: Test Diagnostic Endpoint

```bash
# Test static file serving (if available)
curl https://your-app.ondigitalocean.app/api/v1/debug/static

# Should return:
# {
#   "workDir": "/app",
#   "staticDir": "./static",
#   "exists": true,
#   "indexHtmlExists": true
# }
```

### Step 3: Test Frontend Access

```bash
# Should return HTML
curl https://your-app.ondigitalocean.app/

# Should return HTML directly
curl https://your-app.ondigitalocean.app/index.html
```

### Step 4: Check Browser DevTools

1. Open browser DevTools (F12)
2. Check **Console** tab for errors
3. Check **Network** tab for failed requests
4. Check **Application** tab → Local Storage for tokens

---

## Expected File Structure

### Docker Container
```
/app/
├── comex-back          # Go binary
├── config.yml
├── migrations/
├── logs/
└── static/            # Frontend files
    ├── index.html
    ├── main-*.js
    ├── polyfills-*.js
    ├── styles-*.css
    └── assets/
        └── i18n/
            ├── en.json
            └── uk.json
```

### Server Deployment
```
/var/www/b2b/current/
├── index.html
├── main-*.js
├── polyfills-*.js
├── styles-*.css
└── assets/
    └── i18n/
        ├── en.json
        └── uk.json
```

---

## Quick Fix Checklist

- [ ] `STATIC_DIR=./static` is set in environment variables
- [ ] Frontend build completed successfully in build logs
- [ ] No "static directory not found" warning in runtime logs
- [ ] Can access `https://your-app.ondigitalocean.app/` (should return HTML)
- [ ] Can access `https://your-app.ondigitalocean.app/index.html` (should return HTML)
- [ ] Translation files exist in `assets/i18n/`
- [ ] Browser console shows no errors
- [ ] API calls succeed (check Network tab)

---

## Still Not Working?

1. **Check Build Logs**: Look for any errors during Docker build
2. **Check Runtime Logs**: Look for warnings about static directory
3. **Verify Environment Variables**: Double-check `STATIC_DIR` is set correctly
4. **Rebuild**: Try triggering a new deployment
5. **Check Dockerfile**: Ensure COPY command path matches Angular output path
6. **Test Locally**: Build and test locally first: `docker-compose up --build`

---

## Related Documentation

- [Local Development Guide](../getting-started/frontend-local-development.md)
- [Deployment Guide](../deployment/overview.md)
- [Docker Deployment](../deployment/docker.md)
- [Nginx Setup](../deployment/nginx.md)
