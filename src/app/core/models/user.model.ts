/**
 * Roles the backend accepts on write — mirrors `entity.StaffRoles` in Go,
 * where the same list backs the `oneof` validation tag on User.Role.
 *
 * The retired values "user" and "client" are deliberately absent. Neither was
 * ever read by an authorization gate — every check tests for admin, manager or
 * content_editor — so an account holding one could log in and then reach
 * nothing beyond the /auth self-service endpoints. Blocking an account is what
 * the `active` flag is for. Rows may still hold a legacy value, so treat any
 * role outside this list as "needs re-roling", not as an error.
 */
export const KNOWN_ROLES = ['admin', 'manager', 'content_editor'] as const;

// User entity (from /auth/me endpoint)
export interface User {
  uid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  /** Login gate. False means blocked by an admin or dropped from the ERP roster. */
  active?: boolean;
  // Optional store assignment (new in multi-store backend)
  store_uid?: string;
  // Optional price type assignment
  price_type_uid?: string;
  // Notification preferences
  receive_email_notifications?: boolean;
  all_orders?: boolean;
}

// Client entity (from /auth/me endpoint)
export interface Client {
  uid: string;
  name: string;
  email: string;
  phone: string;
  pin_code: string;
  address: string;
  discount: number;
  additional_discount?: number; // Bonus discount in percentage points, added after any product discount limit
  vat_rate?: number; // VAT rate percentage (0-100)
  vat_number?: string; // VAT registration number (if registered)
  business_registration_number?: string; // Business registration number
  currency: string;
  price_type_uid: string;
  store_uid: string; // Required: store assigned to client
  balance?: number; // Current monthly purchase turnover in cents (set by CRM)
  fixed_discount?: boolean; // If true, use discount field; if false, use scale lookup
  cumulative_discount?: boolean; // If true, use balance+order for scale; if false, only order total
  language?: string; // Preferred language for product descriptions and UI
}

// Token information
export interface TokenInfo {
  token_uid: string;
  issued_at: string;
  expires_at: string;
  last_used?: string;
  user_agent?: string;
  ip_address?: string;
  is_current?: boolean;
}

// Login request for user authentication
export interface UserLoginRequest {
  username: string;
  password: string;
}

// Login request for client authentication
export interface ClientLoginRequest {
  phone: string;
  pin_code: string;
}

// Combined login request type
export type LoginRequest = UserLoginRequest | ClientLoginRequest;

// Login response from /auth/login
export interface LoginResponse {
  success: boolean;
  status_message: string;
  data: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    expires_at: string;
    entity_type: 'user' | 'client';
    entity_uid: string;
  };
}

// Refresh token request
export interface RefreshTokenRequest {
  refresh_token: string;
}

// Current user/client info from /auth/me
export interface AuthMeResponse {
  status: string;
  data: {
    entity_type: 'user' | 'client';
    user?: User;
    client?: Client;
    token_info: TokenInfo;
  };
}

// List of active tokens from /auth/tokens
export interface TokensListResponse {
  status: string;
  data: TokenInfo[];
}

// Re-export ApiResponse from shared model for backward compatibility
export { ApiResponse } from './api.model';
