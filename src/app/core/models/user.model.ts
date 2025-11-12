// User entity (from /auth/me endpoint)
export interface User {
  uid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
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
  currency: string;
  price_type_uid: string;
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
  status: string;
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

// Standard API response structure
export interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

