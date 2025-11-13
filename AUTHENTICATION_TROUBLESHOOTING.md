# Authentication Troubleshooting Guide

This guide helps you resolve authentication issues with the B2B Portal application.

## Common Error: "Invalid credentials"

If you're seeing an error message like "Invalid email or password" or "Invalid credentials", here are the most common causes and solutions:

### 1. Backend API Not Running

**Problem**: The backend API service (`b2b-back`) is not running or not accessible.

**Symptoms**:
- Login always fails regardless of credentials
- Browser console shows network errors (ERR_CONNECTION_REFUSED, 404, etc.)
- No authentication response from server

**Solution**:

1. **Check if the backend is running**:
   ```bash
   # If using Go backend
   cd path/to/b2b-back
   go run main.go

   # Or if using Docker
   docker ps | grep b2b-back
   ```

2. **Verify backend URL**:
   - Development: `http://localhost:8080/api/v1`
   - Production: Set in `API_URL` environment variable

3. **Check backend logs** for errors

4. **Test backend directly**:
   ```bash
   # Test health endpoint (if available)
   curl http://localhost:8080/api/v1/health

   # Test login endpoint
   curl -X POST http://localhost:8080/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"password123"}'
   ```

### 2. CORS Issues

**Problem**: Browser blocks requests due to Cross-Origin Resource Sharing (CORS) policy.

**Symptoms**:
- Browser console shows CORS errors
- "Access to XMLHttpRequest has been blocked by CORS policy"
- Network tab shows OPTIONS requests failing

**Solution**:

Configure CORS in your backend to allow requests from the frontend:

```go
// Example for Go backend
router.Use(cors.New(cors.Config{
    AllowOrigins:     []string{"http://localhost:4200", "https://b2b.darkbyrior.com"},
    AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
    AllowCredentials: true,
}))
```

### 3. Wrong API URL Configuration

**Problem**: Frontend is pointing to the wrong API endpoint.

**Symptoms**:
- 404 errors in network tab
- Requests going to wrong URL

**Solution**:

**For Development**:

Edit `src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api/v1' // Change this to your backend URL
};
```

**For Production Deployment**:

Set the `API_URL` environment variable or GitHub variable:
```bash
export API_URL="https://api.darkbyrior.com/api/v1"
npm run build:prod
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for more details.

### 4. Invalid Credentials

**Problem**: Using wrong username/password or phone/PIN combination.

**Solution**:

The application now automatically detects whether you're logging in as a **User** or **Client** based on the format of your identifier:

#### User Login (username + password):
- **Identifier**: Any text (e.g., `admin`, `john_doe`)
- **Credential**: Password (min 4 characters, typically 6+)

Example:
```
Username/Phone: admin
Password/PIN: password123
```

#### Client Login (phone + PIN):
- **Identifier**: Phone number with 10+ digits (e.g., `+1234567890`)
- **Credential**: 4-digit PIN code

Example:
```
Username/Phone: +1234567890
Password/PIN: 1234
```

**Detection Logic**:
- If identifier has 10+ digits and optional `+`, it's treated as **Client** login
- Otherwise, it's treated as **User** login

### 5. Backend Database Not Initialized

**Problem**: Backend database doesn't have any users or proper schema.

**Symptoms**:
- Login fails even with correct credentials
- Backend logs show database errors

**Solution**:

1. **Check database connection** in backend
2. **Run database migrations**:
   ```bash
   # Example for Go backend
   go run migrations/main.go
   ```

3. **Create initial user** (if needed):
   ```bash
   # Using backend CLI or SQL
   INSERT INTO users (uid, username, email, password, first_name, last_name, role)
   VALUES ('user-1', 'admin', 'admin@example.com', 'hashed_password', 'Admin', 'User', 'admin');
   ```

### 6. Token Issues

**Problem**: Token-related errors after successful login.

**Symptoms**:
- Login succeeds but immediately logs out
- "Unauthorized" errors on subsequent requests
- Token not being sent with requests

**Solution**:

1. **Clear browser storage**:
   ```javascript
   // Open browser console
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

2. **Check token in localStorage**:
   ```javascript
   // Open browser console
   console.log(JSON.parse(localStorage.getItem('authData')));
   ```

3. **Verify token format** in backend responses

## Debugging Tips

### 1. Enable Browser DevTools

Open Chrome/Firefox DevTools (F12) and check:

**Console Tab**:
- Look for error messages
- Check for CORS errors
- Look for API call failures

**Network Tab**:
- Filter by XHR/Fetch
- Look for failed requests (red)
- Check request/response details
- Verify request headers include Authorization token

### 2. Check Backend Logs

Monitor backend logs while attempting login:
```bash
# For Go backend
go run main.go 2>&1 | grep -i "login\|auth\|error"
```

Look for:
- Authentication errors
- Database connection issues
- Invalid credentials logs

### 3. Test API Endpoints Directly

Use curl or Postman to test the API:

```bash
# Login as User
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }' | jq

# Login as Client
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "pin_code": "1234"
  }' | jq

# Test authenticated endpoint
curl -X GET http://localhost:8080/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" | jq
```

### 4. Check Environment Configuration

**Development**:
```bash
# Verify environment file
cat src/environments/environment.ts
```

**Production**:
```bash
# Check GitHub secrets/variables
# Go to: Repository → Settings → Secrets and variables → Actions
```

## Quick Checklist

Before reporting an authentication issue, verify:

- [ ] Backend API is running
- [ ] Backend is accessible at the configured URL
- [ ] CORS is properly configured
- [ ] Database is initialized with users/clients
- [ ] API URL is correct in environment configuration
- [ ] Using correct credential format (username+password OR phone+PIN)
- [ ] Browser console shows no CORS errors
- [ ] Network tab shows 200 OK from `/auth/login` endpoint

## Still Having Issues?

If none of the above solutions work:

1. **Check the API documentation**: [api_documentation.md](./api_documentation.md)
2. **Review backend logs** for specific error messages
3. **Test with curl** to isolate frontend vs backend issues
4. **Check GitHub Issues** for similar problems
5. **Contact the development team** with:
   - Error message and screenshot
   - Browser console logs
   - Network tab screenshot showing failed request
   - Backend API logs (if accessible)

## Related Documentation

- [README.md](./README.md) - Project setup
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment configuration
- [api_documentation.md](./api_documentation.md) - API reference
- [CLAUDE.md](./CLAUDE.md) - Development guidelines
