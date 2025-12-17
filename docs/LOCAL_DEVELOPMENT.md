# Local Development Configuration

This guide explains how to configure the frontend for local development with a custom backend URL that won't be committed to GitHub.

## Quick Setup

### 1. Create Your Local Environment File

Copy the example file to create your local configuration:

```bash
cd frontend
cp src/environments/environment.local.example.ts src/environments/environment.local.ts
```

### 2. Customize Your Local Configuration

Edit `src/environments/environment.local.ts` and set your dev backend URL:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8888/api/v1', // Change to your dev backend URL
  appTitle: 'B2B Portal (Local Dev)' // Optional: customize app title
};
```

**Common backend URLs:**
- Docker backend: `http://localhost:8888/api/v1` (no proxy needed)
- Local Go backend: `http://localhost:8080/api/v1` (no proxy needed)
- Remote dev server: Use `/api/v1` (relative path) - proxy will forward to remote server

### 3. Run with Local Configuration

Use the `local` configuration when starting the dev server:

```bash
ng serve --configuration=local
```

Or add it to your `package.json` scripts:

```json
"start:local": "ng serve --configuration=local"
```

Then run:

```bash
npm run start:local
```

## How It Works

- **`environment.ts`** - Default development environment (committed to git)
- **`environment.local.ts`** - Your local configuration (gitignored, not committed)
- **`environment.local.example.ts`** - Template file (committed, safe to share)

When you use `--configuration=local`, Angular replaces `environment.ts` with `environment.local.ts` at build time.

## Configuration Options

### Development Configurations

1. **Default Development** (`ng serve` or `ng serve --configuration=development`)
   - Uses `environment.ts`
   - Default API URL: `http://localhost:8888/api/v1`
   - Safe to commit changes

2. **Local Development** (`ng serve --configuration=local`)
   - Uses `environment.local.ts`
   - Your custom API URL
   - **Proxy enabled**: Requests to `/api/*` are proxied to remote server (configured in `proxy.conf.json`)
   - File is gitignored, won't be committed

3. **Production** (`ng build --configuration=production`)
   - Uses `environment.prod.ts`
   - API URL: `/api/v1` (relative path)

## Important Notes

- ✅ `environment.local.ts` is already in `.gitignore` - your local changes won't be committed
- ✅ You can customize `apiUrl` and `appTitle` without affecting other developers
- ✅ The example file (`environment.local.example.ts`) is committed as a template
- ⚠️ Always use `--configuration=local` when you want to use your local settings
- ⚠️ If `environment.local.ts` doesn't exist, Angular will use `environment.ts` instead

## Troubleshooting

### Configuration Not Working

If your local configuration isn't being used:

1. **Check file exists**: Ensure `src/environments/environment.local.ts` exists
2. **Check configuration**: Make sure you're using `--configuration=local`
3. **Check syntax**: Verify the TypeScript syntax is correct
4. **Restart dev server**: Stop and restart `ng serve`

### Backend Connection Issues

If you can't connect to your backend:

1. **Check backend is running**: Verify your backend server is running
2. **Check URL**: Ensure the `apiUrl` in `environment.local.ts` is correct
3. **For remote servers**: Use `/api/v1` (relative path) in `environment.local.ts` - the proxy will handle forwarding
4. **Check proxy configuration**: If using remote server, verify `proxy.conf.json` has correct target URL
5. **Check CORS**: For local backends on different ports, ensure CORS is configured. For remote servers, use the proxy (no CORS needed)
6. **Check network**: Use browser DevTools Network tab to see API requests

### Using Remote Backend (CORS Solution)

If you need to connect to a remote backend (e.g., `https://b2b.example.com`):

1. **Set relative URL in environment.local.ts**:
   ```typescript
   apiUrl: '/api/v1' // Use relative path
   ```

2. **Configure proxy** (already set up in `proxy.conf.json`):
   - The proxy forwards `/api/*` requests to the remote server
   - This avoids CORS issues since requests appear to come from the same origin

3. **Run with local configuration**:
   ```bash
   npm run local
   # or
   ng serve --configuration=local
   ```

4. **Verify proxy is working**: Check browser console - requests should go to `http://localhost:4200/api/v1/*` (not the remote URL directly)

### Example: Connecting to Different Backend Ports

```typescript
// For backend on port 8080
apiUrl: 'http://localhost:8080/api/v1'

// For backend on port 3000
apiUrl: 'http://localhost:3000/api/v1'

// For remote dev server
apiUrl: 'https://dev-api.example.com/api/v1'
```

## Best Practices

1. **Never commit `environment.local.ts`** - It's already gitignored, but double-check before committing
2. **Update example file** - If you add new environment variables, update `environment.local.example.ts` too
3. **Document your setup** - Consider adding notes in `environment.local.ts` about your specific setup
4. **Use relative paths for production** - Production uses `/api/v1` (relative) for flexibility

## Adding New Environment Variables

If you need to add new environment variables:

1. Add to `environment.ts` (with default value)
2. Add to `environment.prod.ts` (with production value)
3. Add to `environment.local.example.ts` (with example value)
4. Add to `environment.local.ts` (with your local value)

Example:

```typescript
// environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8888/api/v1',
  appTitle: 'B2B Portal',
  enableDebug: true // New variable
};

// environment.local.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api/v1', // Your custom URL
  appTitle: 'B2B Portal (Local Dev)',
  enableDebug: true // Your custom value
};
```
