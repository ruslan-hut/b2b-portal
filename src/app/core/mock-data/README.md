# Mock Data

This directory contains mock data files used throughout the application for testing purposes.

## Files

- **users.mock.ts** - Mock user accounts for authentication testing
- **products.mock.ts** - Mock product catalog with 15 products across 3 categories
- **orders.mock.ts** - Mock order history with 6 sample orders

## Usage

These mock data files are imported by the respective services:
- `AuthService` → `users.mock.ts`
- `ProductService` → `products.mock.ts`
- `OrderService` → `orders.mock.ts`

## Documentation

For complete documentation about available mock data, test credentials, and testing scenarios, see:
**[/MOCK_DATA.md](../../../../MOCK_DATA.md)** in the project root.

## Future API Integration

When integrating with real APIs:
1. Update the service imports to use HttpClient instead of these mock files
2. Keep these files for reference or testing purposes
3. Consider using them in unit tests

## Quick Reference

### Test Users
- `admin@example.com` - Admin account
- `client@example.com` - Client account  
- `demo@example.com` - Demo account

### Categories
- Electronics (5 products)
- Office Supplies (5 products)
- Furniture (5 products)

### Order Statuses
- PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED

