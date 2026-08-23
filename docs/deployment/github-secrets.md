# GitHub Secrets Configuration Guide

This guide explains how to configure GitHub Secrets for the deployment workflow.

## Required Secrets

These secrets **must** be configured for deployment to work:

### Docker Hub (for Docker Hub Push Workflow)
- **`DOCKER_USERNAME`**: Your Docker Hub username
  - Example: `myusername`
  - Required for automatic Docker image pushes to Docker Hub

- **`DOCKER_PASSWORD`**: Your Docker Hub password or access token
  - **Recommended**: Use a Docker Hub access token instead of password
  - Generate token at: https://hub.docker.com/settings/security
  - Token should have "Read, Write & Delete" permissions
  - Example: `dckr_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### SSH Access
- **`SSH_PRIVATE_KEY`**: Private SSH key for server access
  - Generate with: `ssh-keygen -t rsa -b 4096 -C "github-actions"`
  - Copy the **private** key content (including `-----BEGIN` and `-----END` lines)
  - Add the **public** key to your server's `~/.ssh/authorized_keys`

- **`SSH_HOST`**: Server hostname or IP address
  - Example: `192.168.1.100` or `server.example.com`

- **`SSH_USER`**: SSH username for server access
  - Example: `deploy` or `ubuntu`

### JWT Configuration
- **`JWT_SECRET_KEY`**: JWT secret key for token signing
  - **Minimum 32 characters recommended**
  - Generate with: `openssl rand -base64 32`
  - **CRITICAL**: Never use default values like `"change-me-in-production"`
  - Example: `aB3dEf9gHiJkLmNoPqRsTuVwXyZ1234567890AbCdEfGhIjKlMnOpQrStUvWxYz`

### Admin API Configuration (Optional)
- **`ADMIN_TOKEN`**: Admin token for admin API access
  - **Required to enable admin API** - if not set, admin API is disabled
  - Generate with: `openssl rand -hex 32`
  - Used for admin user management endpoints (`/api/v1/admin/*`)
  - Must be provided as Bearer token: `Authorization: Bearer <admin_token>`

### Client API Configuration
- **`CLIENT_API_KEY_PEPPER`** (PL) / **`UA_CLIENT_API_KEY_PEPPER`** (UA): server secret mixed into every stored Client API key hash
  - **Required for the Client API** (`/api/client/v1`) — without it no client key can authenticate (fail closed) and the backend logs a warning at startup
  - Generate with: `openssl rand -hex 32`
  - **Rotating it invalidates every issued client key** — treat it like the JWT secret
  - See `docs/api/client-api.md`
  - Example: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`
  - **Security**: Use a strong, randomly generated token

### Database Configuration
- **`DATABASE_USER`**: Database username
  - Example: `comex_user`

- **`DATABASE_PASSWORD`**: Database password
  - Use a strong password
  - Example: `SecurePassword123!`

- **`DATABASE_NAME`**: Database name
  - Example: `comex_db`

## Optional Secrets

These secrets have defaults but can be customized:

### Database (Optional)
- **`DATABASE_HOST`**: Database hostname
  - Default: `localhost`
  - Example: `db.example.com` or `192.168.1.10`

- **`DATABASE_PORT`**: Database port
  - Default: `3306`
  - Example: `5432` (for PostgreSQL)

- **`DATABASE_DRIVER`**: Database driver
  - Default: `mysql`
  - Options: `mysql`, `postgres`
  
- **`DATABASE_SSL_MODE`**: SSL mode for database connection
  - Default: `disable`
  - Options: `disable`, `require`, `verify-ca`, `verify-full`
  - Use `require` for DigitalOcean Managed Databases

### Server Configuration (Optional)
- **`LISTEN_BIND_IP`**: Server bind IP address
  - Default: `0.0.0.0` (listen on all interfaces)
  - Use `127.0.0.1` for localhost only

- **`LISTEN_PORT`**: Server port
  - Default: `8888`
  - Example: `8080`

- **`LISTEN_API_KEY`**: API key for service-to-service calls
  - Default: `your-api-key`
  - Generate a secure random key

### Telegram Bot (Optional)
- **`TELEGRAM_ENABLED`**: Enable Telegram bot
  - Default: `false`
  - Set to `true` to enable

- **`TELEGRAM_API_KEY`**: Telegram bot API key (if enabled)
  - Get from [@BotFather](https://t.me/botfather) on Telegram
  - Example: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

- **`TELEGRAM_ADMIN_ID`**: Telegram admin user ID (if enabled)
  - Get your user ID from [@userinfobot](https://t.me/userinfobot)
  - Example: `123456789`

- **`TELEGRAM_BOT_NAME`**: Telegram bot name (if enabled)
  - Example: `Comex Bot`

### Database Logging (Optional)
- **`LOGGING_DATABASE_ENABLED`**: Enable database logging
  - Default: `true`
  - Set to `false` to disable database logging
  - When enabled, all application logs are stored in the database
  - Example: `true` or `false`

- **`LOGGING_DATABASE_RETENTION_DAYS`**: Log retention period in days
  - Default: `90`
  - Logs older than this number of days will be automatically deleted
  - Must be a positive integer
  - Example: `30`, `60`, `90`, `180`

- **`LOGGING_DATABASE_BATCH_SIZE`**: Number of logs to batch before flushing to database
  - Default: `100`
  - Higher values improve performance but use more memory
  - Must be a positive integer
  - Example: `50`, `100`, `200`

- **`LOGGING_DATABASE_FLUSH_INTERVAL`**: Maximum time to wait before flushing logs
  - Default: `5s`
  - Logs are flushed when batch size is reached OR this interval expires
  - Format: Go duration string (e.g., `5s`, `10s`, `1m`)
  - Example: `5s`, `10s`, `30s`

### Frontend Configuration (Optional)
- **`API_URL`**: Backend API URL for frontend
  - Default: `https://api.portal.example/api/v1`
  - Example: `https://api.example.com/api/v1`

- **`APP_TITLE`**: Application title
  - Default: `B2B Portal`
  - Example: `My B2B Portal`

### Docker Hub Build Configuration (Optional)
- **`DOCKER_APP_TITLE`**: Application title for Docker Hub builds
  - Default: Falls back to `APP_TITLE` or `B2B Portal`
  - Example: `My B2B Portal`
  - **Note**: Use this to override `APP_TITLE` specifically for Docker Hub images

- **`DOCKER_API_URL`**: API URL for Docker Hub builds
  - Default: Falls back to `API_URL` or `/api/v1`
  - Example: `/api/v1`
  - **Note**: Use this to override `API_URL` specifically for Docker Hub images

## How to Configure Secrets

### Step 1: Navigate to Repository Settings

1. Go to your GitHub repository
2. Click on **Settings** (top navigation)
3. Click on **Secrets and variables** → **Actions** (left sidebar)

### Step 2: Add Each Secret

1. Click **New repository secret**
2. Enter the secret name (e.g., `JWT_SECRET_KEY`)
3. Enter the secret value
4. Click **Add secret**
5. Repeat for all required secrets

### Step 3: Verify Secrets

After adding secrets, you can verify they exist (but not their values) in the secrets list.

## Secret Generation Commands

### Generate JWT Secret Key
```bash
openssl rand -base64 32
```

### Generate API Key
```bash
openssl rand -hex 32
```

### Generate Admin Token
```bash
openssl rand -hex 32
```

### Generate Database Password
```bash
openssl rand -base64 24
```

### Generate SSH Key Pair
```bash
# Generate key pair
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# Display private key (for SSH_PRIVATE_KEY secret)
cat ~/.ssh/github_actions_deploy

# Display public key (to add to server)
cat ~/.ssh/github_actions_deploy.pub
```

## Security Best Practices

1. **Never commit secrets to the repository**
   - Secrets should only be stored in GitHub Secrets
   - Never hardcode secrets in code or config files

2. **Use strong, unique passwords**
   - Generate random passwords for all services
   - Use different passwords for different environments

3. **Rotate secrets regularly**
   - Change passwords periodically
   - Update secrets if compromised

4. **Limit secret access**
   - Only grant access to trusted team members
   - Use environment-specific secrets for different deployments

5. **Monitor secret usage**
   - Review GitHub Actions logs regularly
   - Check for unauthorized access attempts

## Troubleshooting

### Secret Not Found Error

If you see an error like "Secret not found":
1. Verify the secret name matches exactly (case-sensitive)
2. Check that the secret is configured in the correct repository
3. Ensure you're using `secrets.SECRET_NAME` in the workflow

### Invalid Secret Value

If deployment fails with configuration errors:
1. Check the GitHub Actions logs for specific error messages
2. Verify secret values are correct (no extra spaces/newlines)
3. For JWT_SECRET_KEY, ensure it's at least 32 characters
4. Test database credentials manually before deployment

### Secret Not Updating

If changes to secrets don't take effect:
1. Secrets are only available to new workflow runs
2. Trigger a new deployment manually if needed
3. Check that you edited the correct secret (typos in names)

## Example: Complete Secret Setup

Here's an example of all secrets configured:

```
SSH_PRIVATE_KEY: -----BEGIN OPENSSH PRIVATE KEY-----...
SSH_HOST: 192.168.1.100
SSH_USER: deploy
JWT_SECRET_KEY: aB3dEf9gHiJkLmNoPqRsTuVwXyZ1234567890AbCdEfGhIjKlMnOpQrStUvWxYz
ADMIN_TOKEN: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
DATABASE_HOST: localhost
DATABASE_PORT: 3306
DATABASE_USER: comex_user
DATABASE_PASSWORD: SecurePassword123!
DATABASE_NAME: comex_db
DATABASE_SSL_MODE: require
LISTEN_BIND_IP: 0.0.0.0
LISTEN_PORT: 8888
LISTEN_API_KEY: abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
LOGGING_DATABASE_ENABLED: true
LOGGING_DATABASE_RETENTION_DAYS: 90
LOGGING_DATABASE_BATCH_SIZE: 100
LOGGING_DATABASE_FLUSH_INTERVAL: 5s
```

## Related Documentation

- [GitHub Actions Deployment](./github-actions.md)
- [Systemd Troubleshooting](../troubleshooting/systemd.md)
- [Local Development](../getting-started/frontend-local-development.md)
- [Deployment Overview](./overview.md)
