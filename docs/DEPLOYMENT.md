# Deployment Configuration

This document explains how to configure and deploy the B2B Portal application with custom API endpoints.

## Architecture Overview

**Important**: The frontend in production mode **always uses relative URLs** (`/api/v1`) by default. This works seamlessly for both deployment scenarios:

- **Scenario 1 (Server + Nginx)**: Frontend served by Nginx, which proxies `/api/*` requests to backend
- **Scenario 2 (Docker Monolith)**: Backend serves both frontend and API from the same origin

The backend API is always available at `/api/v1` path. The frontend uses relative paths, so it automatically works regardless of the domain or port.

**Default Configuration**:
- `API_URL` defaults to `/api/v1` (relative path)
- No configuration needed for standard deployments
- Only configure `API_URL` if you need a different path or absolute URL (not recommended)

## GitHub Actions Configuration

The application uses GitHub Actions for automated deployment to production. The deployment process includes automatic configuration of the backend API URL.

### Setting up GitHub Variables

To configure the backend API URL and application title for deployment, you need to set the following variables in your GitHub repository.

#### Option 1: Using GitHub Repository Variables (Recommended)

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click on the **Variables** tab
4. Click **New repository variable**
5. Set the following variables:
   - **Name**: `API_URL`
     - **Value**: Backend API URL (default: `/api/v1` - relative path)
     - **Note**: Use relative path `/api/v1` for both deployment scenarios (Nginx proxy or Docker monolith)
     - **Example**: `/api/v1` (recommended) or `https://api.portal.example/api/v1` (only if different domain)
   - **Name**: `APP_TITLE` (optional)
     - **Value**: Your application title (e.g., `My B2B Portal`)
6. Click **Add variable**

#### Option 2: Using GitHub Secrets (For sensitive URLs)

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click on the **Secrets** tab
4. Click **New repository secret**
5. Set:
   - **Name**: `API_URL`
   - **Value**: Backend API URL (default: `/api/v1` - relative path)
   - **Note**: Use relative path `/api/v1` for both deployment scenarios
6. Click **Add secret**

### Default Values

If environment variables are not configured, the deployment will use the following default values:
- **API_URL**: `/api/v1` (relative path - works for both Nginx proxy and Docker monolith scenarios)
- **APP_TITLE**: `B2B Portal`

**Important**: The frontend in production mode **always** uses relative URLs `/api/v1` by default. This works for both deployment scenarios:
- **Scenario 1 (Server + Nginx)**: Nginx proxies `/api/*` requests to backend
- **Scenario 2 (Docker Monolith)**: Backend serves both frontend and API from same origin

Only use absolute URLs if your API is on a completely different domain (not recommended).

### How It Works

1. **During Build**: The GitHub Actions workflow sets the `API_URL` and `APP_TITLE` environment variables
2. **Environment Substitution**: The `scripts/set-env.js` script:
   - Replaces the placeholder in `src/environments/environment.prod.ts` with the actual API URL
   - Updates the `<title>` tag in `src/index.html` with the configured app title
3. **Production Build**: Angular builds the application with the configured values
4. **Deployment**: The built application is deployed to the server

## Local Development

### Development Server

For local development, the application uses `src/environments/environment.ts` with:
```typescript
apiUrl: 'http://localhost:8080/api/v1'
```

Start the development server:
```bash
npm start
# or
ng serve
```

### Testing Production Build Locally

To test the production build with custom configuration locally:

```bash
# Set environment variables (optional - defaults to /api/v1)
export API_URL="/api/v1"  # Relative path (recommended)
export APP_TITLE="My Custom Portal"

# Build for production
npm run build:prod
```

Or on Windows (PowerShell):
```powershell
$env:API_URL="/api/v1"  # Relative path (recommended)
$env:APP_TITLE="My Custom Portal"
npm run build:prod
```

**Note**: If you don't set `API_URL`, it defaults to `/api/v1` (relative path), which works for both deployment scenarios.

## NPM Scripts

- `npm start` - Start development server
- `npm run build` - Build for development
- `npm run build:prod` - Set environment variables and build for production
- `npm run set-env` - Only set environment variables (replace API_URL and APP_TITLE in files)
- `npm test` - Run unit tests

## GitHub Actions Workflow

The deployment workflow (`.github/workflows/deploy-b2b.yml`) automatically:

1. Checks out the code
2. Installs dependencies
3. Sets the `API_URL` and `APP_TITLE` environment variables from GitHub secrets/variables
4. Runs `scripts/set-env.js` to replace values in environment files and index.html
5. Builds the application for production
6. Packages the build artifacts
7. Deploys to the production server

### Workflow Environment Variables

The workflow supports the following environment variables:

| Variable | Description | Default | Source |
|----------|-------------|---------|--------|
| `API_URL` | Backend API URL (relative path recommended) | `/api/v1` | GitHub Secrets or Variables |
| `APP_TITLE` | Application title | `B2B Portal` | GitHub Secrets or Variables |
| `BASE_HREF` | Application base href | `/` | Workflow env |
| `DEPLOY_URL` | Deployment URL | `/` | Workflow env |

**Note**: `API_URL` defaults to `/api/v1` (relative path) which works for both deployment scenarios. Only use absolute URLs if your API is on a different domain.

### Triggering Deployment

Deployment is automatically triggered when you push to the `main` branch:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

## Server Configuration

### Required GitHub Secrets

The following secrets must be configured in your GitHub repository for deployment:

| Secret | Description |
|--------|-------------|
| `API_URL` | Backend API endpoint URL (default: `/api/v1` - relative path) |
| `SSH_PRIVATE_KEY` | SSH private key for server access |
| `SSH_HOST` | Server hostname or IP address |
| `SSH_USER` | SSH username |
| `DEPLOY_PATH` | Path on server where application will be deployed |

### Server Structure

The application is deployed to the server using a release-based structure:

```
DEPLOY_PATH/
├── releases/
│   ├── release-{commit-sha-1}/
│   ├── release-{commit-sha-2}/
│   └── release-{commit-sha-3}/
└── current -> releases/release-{latest}/
```

Only the 5 most recent releases are kept on the server.

## Troubleshooting

### API URL Not Updating

If the API URL is not updating after setting the GitHub variable:

1. Check that the variable name is exactly `API_URL` (case-sensitive)
2. Verify the workflow run in **Actions** tab to see the environment variables
3. Check the build logs for the "Setting environment variables..." message
4. Ensure the workflow file includes the API_URL in the env section

### Build Failures

If the build fails during deployment:

1. Check the GitHub Actions logs in the **Actions** tab
2. Verify all required secrets are configured
3. Test the build locally with `npm run build:prod`
4. Check that Node.js version matches (22.12)

### API Connection Issues

If the application cannot connect to the API after deployment:

1. Verify the `API_URL` is correct (should be `/api/v1` for relative path)
2. For Scenario 1 (Nginx): Check that Nginx is proxying `/api/*` to backend
3. For Scenario 2 (Docker): Check that backend is serving API at `/api/v1`
4. Check CORS configuration on the backend
5. Verify the API is running and accessible from the deployed location
6. Check browser console for API errors
7. Verify backend serves API routes at `/api/v1` (check `/api/v1/health` endpoint)

## Related Documentation

- [README.md](./README.md) - Project overview and setup
- [CLAUDE.md](./CLAUDE.md) - Development guidelines
- [api_documentation.md](./api_documentation.md) - API reference
