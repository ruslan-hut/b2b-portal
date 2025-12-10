# Mock Data Documentation

> **⚠️ DEPRECATED**: This document describes mock data functionality that is **no longer actively used** in the application. The frontend services now use **real API calls** via HttpClient. Mock data files remain in the codebase for fallback scenarios only.

## Current Status

**Services are using real API integration:**
- ✅ `AuthService` - Uses `HttpClient` for authentication
- ✅ `ProductService` - Uses `HttpClient` for product data
- ✅ `OrderService` - Uses `HttpClient` for order operations (with mock fallback only)

**Mock data location:** `src/app/core/mock-data/`
- Files exist but are **not actively used** in normal operation
- Only used as fallback when API calls fail or user is not authenticated

## Legacy Mock Data Structure

The following mock data files exist for reference:

- **users.mock.ts** - User accounts and credentials
- **products.mock.ts** - Product catalog and categories  
- **orders.mock.ts** - Order history

## Migration Notes

When the application was migrated from mock data to real API:

1. **Services Updated**: All services now use `HttpClient` instead of mock Observables
2. **API Integration**: Services call backend endpoints at `/api/v1/*`
3. **Fallback Only**: Mock data is only used when:
   - User is not authenticated (order history fallback)
   - API call fails (error handling)

## For Testing

If you need to test with mock data:

1. **Development**: Use the backend API (recommended)
2. **Isolated Testing**: Mock data files can be imported directly in unit tests
3. **Offline Testing**: Services have fallback logic for offline scenarios

## Related Documentation

- **[API Documentation](./api_documentation.md)** - Real API integration guide
- **[Backend API Documentation](../../backend/docs/api_documentation.md)** - Complete backend API reference

---

**Last Updated**: January 2025  
**Status**: Deprecated - Services use real API integration
