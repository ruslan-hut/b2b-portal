# Deployment Configuration

This document explains how to configure and deploy the B2B Portal application with custom API endpoints.

## GitHub Actions Configuration

The application uses GitHub Actions for automated deployment to production. The deployment process includes automatic configuration of the backend API URL.

### Setting up GitHub Variables

To configure the backend API URL for deployment, you need to set the `API_URL` variable in your GitHub repository.

#### Option 1: Using GitHub Repository Variables (Recommended)

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click on the **Variables** tab
4. Click **New repository variable**
5. Set:
   - **Name**: `API_URL`
   - **Value**: Your backend API URL (e.g., `https://api.darkbyrior.com/api/v1`)
6. Click **Add variable**

#### Option 2: Using GitHub Secrets (For sensitive URLs)

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click on the **Secrets** tab
4. Click **New repository secret**
5. Set:
   - **Name**: `API_URL`
   - **Value**: Your backend API URL (e.g., `https://api.darkbyrior.com/api/v1`)
6. Click **Add secret**

### Default Values

If no `API_URL` is configured, the deployment will use the default value:
- **Default**: `https://api.darkbyrior.com/api/v1`

### How It Works

1. **During Build**: The GitHub Actions workflow sets the `API_URL` environment variable
2. **Environment Substitution**: The `scripts/set-env.js` script replaces the placeholder in `src/environments/environment.prod.ts` with the actual API URL
3. **Production Build**: Angular builds the application with the configured API URL
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

To test the production build with a custom API URL locally:

```bash
# Set the API_URL environment variable
export API_URL="https://your-api-url.com/api/v1"

# Build for production
npm run build:prod
```

Or on Windows (PowerShell):
```powershell
$env:API_URL="https://your-api-url.com/api/v1"
npm run build:prod
```

## NPM Scripts

- `npm start` - Start development server
- `npm run build` - Build for development
- `npm run build:prod` - Set environment variables and build for production
- `npm run set-env` - Only set environment variables (replace API_URL in environment.prod.ts)
- `npm test` - Run unit tests

## GitHub Actions Workflow

The deployment workflow (`.github/workflows/deploy-b2b.yml`) automatically:

1. Checks out the code
2. Installs dependencies
3. Sets the `API_URL` environment variable from GitHub secrets/variables
4. Runs `scripts/set-env.js` to replace the API URL in environment files
5. Builds the application for production
6. Packages the build artifacts
7. Deploys to the production server

### Workflow Environment Variables

The workflow supports the following environment variables:

| Variable | Description | Default | Source |
|----------|-------------|---------|--------|
| `API_URL` | Backend API URL | `https://api.darkbyrior.com/api/v1` | GitHub Secrets or Variables |
| `BASE_HREF` | Application base href | `/` | Workflow env |
| `DEPLOY_URL` | Deployment URL | `/` | Workflow env |

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
| `API_URL` | Backend API endpoint URL |
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

1. Verify the `API_URL` is correct and accessible
2. Check CORS configuration on the backend
3. Verify the API is running and accessible from the deployed location
4. Check browser console for API errors

## Related Documentation

- [README.md](./README.md) - Project overview and setup
- [CLAUDE.md](./CLAUDE.md) - Development guidelines
- [api_documentation.md](./api_documentation.md) - API reference
