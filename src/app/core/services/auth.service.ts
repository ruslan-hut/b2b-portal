import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, timer, of } from 'rxjs';
import { map, catchError, switchMap, tap, shareReplay } from 'rxjs/operators';
import {
  LoginRequest,
  LoginResponse,
  User,
  Client,
  AuthMeResponse,
  RefreshTokenRequest,
  TokensListResponse,
  ApiResponse
} from '../models/user.model';
import { environment } from '../../../environments/environment';
import { AppSettingsService } from './app-settings.service';

interface AuthData {
  entityType: 'user' | 'client';
  entity: User | Client;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly AUTH_DATA_KEY = 'BASE_AUTH_DATA';
  private readonly apiUrl = environment.apiUrl;

  private currentEntitySubject: BehaviorSubject<User | Client | null>;
  public currentEntity$: Observable<User | Client | null>;

  private entityTypeSubject: BehaviorSubject<'user' | 'client' | null>;
  public entityType$: Observable<'user' | 'client' | null>;

  private refreshTokenTimeout?: any;

  constructor(
    private http: HttpClient,
    private appSettingsService: AppSettingsService
  ) {
    const authData = this.getStoredAuthData();
    this.currentEntitySubject = new BehaviorSubject<User | Client | null>(
      authData ? authData.entity : null
    );
    this.entityTypeSubject = new BehaviorSubject<'user' | 'client' | null>(
      authData ? authData.entityType : null
    );
    this.currentEntity$ = this.currentEntitySubject.asObservable();
    this.entityType$ = this.entityTypeSubject.asObservable();

    // Start token refresh timer if user is logged in
    if (authData) {
      this.startRefreshTokenTimer(authData.expiresAt);
    }
  }

  public get currentEntityValue(): User | Client | null {
    return this.currentEntitySubject.value;
  }

  public get entityTypeValue(): 'user' | 'client' | null {
    return this.entityTypeSubject.value;
  }

  /**
   * Login with user credentials or client credentials
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials).pipe(
      switchMap(response => {
        if (response.success) {
          // Wait for login success handling to complete
          return this.handleLoginSuccess(response).pipe(
            map(() => response)
          );
        }
        return of(response);
      }),
      catchError(error => {
        console.error('Login error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Logout and revoke current token
   */
  logout(): Observable<any> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      this.clearAuthData();
      return of(null);
    }

    return this.http.post(`${this.apiUrl}/auth/logout`, {}).pipe(
      tap(() => this.clearAuthData()),
      catchError(error => {
        // Even if logout fails on server, clear local data
        this.clearAuthData();
        return throwError(() => error);
      })
    );
  }

  /**
   * Refresh access token using refresh token
   */
  refreshToken(): Observable<LoginResponse> {
    const authData = this.getStoredAuthData();
    if (!authData || !authData.refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    const request: RefreshTokenRequest = {
      refresh_token: authData.refreshToken
    };

    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/refresh`, request).pipe(
      switchMap(response => {
        if (response.success) {
          // Wait for login success handling to complete
          return this.handleLoginSuccess(response).pipe(
            map(() => response)
          );
        }
        return of(response);
      }),
      catchError(error => {
        // If refresh fails, logout user
        this.clearAuthData();
        return throwError(() => error);
      })
    );
  }

  /**
   * Get current user/client information from server
   * Also loads AppSettings which includes currency, store, price type
   */
  getCurrentEntity(): Observable<User | Client> {
    return this.http.get<AuthMeResponse>(`${this.apiUrl}/auth/me`).pipe(
      switchMap(response => {
        // Support both 'status: success' and 'success: true' formats
        const isSuccess = response.status === 'success' || (response as any).success === true;

        if (!isSuccess) {
          console.error('Response not successful:', response);
          return throwError(() => new Error('Failed to get current entity'));
        }

        // Load AppSettings (which includes entity and all related data)
        return this.appSettingsService.loadSettings().pipe(
          map(settings => {
            const entity = settings.entity;

            // Update local state
            this.currentEntitySubject.next(entity);
            this.entityTypeSubject.next(settings.entity_type);

            // Update stored auth data
            const authData = this.getStoredAuthData();
            if (authData) {
              authData.entity = entity;
              authData.entityType = settings.entity_type;
              // Persist user's store UID if available (multi-store support)
              if (settings.entity_type === 'user' && (entity as any).store_uid) {
                // Ensure stored entity reflects store_uid
                authData.entity = entity as any;
              }
              this.storeAuthData(authData);
            }

            return entity;
          })
        );
      }),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Get list of active tokens (all devices)
   */
  getActiveTokens(): Observable<TokensListResponse> {
    return this.http.get<TokensListResponse>(`${this.apiUrl}/auth/tokens`).pipe(
      catchError(error => {
        console.error('Get active tokens error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Revoke specific token (logout from specific device)
   */
  revokeToken(tokenUid: string): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`${this.apiUrl}/auth/tokens/${tokenUid}`).pipe(
      catchError(error => {
        console.error('Revoke token error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Revoke all tokens (logout from all devices)
   */
  revokeAllTokens(): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.apiUrl}/auth/tokens/revoke-all`, {}).pipe(
      tap(() => this.clearAuthData()),
      catchError(error => {
        console.error('Revoke all tokens error:', error);
        // Even if request fails, clear local data
        this.clearAuthData();
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const authData = this.getStoredAuthData();
    if (!authData || !authData.accessToken) {
      return false;
    }

    // Check if token is expired
    const expiresAt = new Date(authData.expiresAt);
    const now = new Date();
    return expiresAt > now;
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    const authData = this.getStoredAuthData();
    return authData ? authData.accessToken : null;
  }

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    const authData = this.getStoredAuthData();
    return authData ? authData.refreshToken : null;
  }

  /**
   * Clear authentication data (public method for guards/interceptors)
   */
  public clearAuth(): void {
    this.clearAuthData();
  }

  /**
   * Debug helper: Inspect current token (call from browser console)
   * Usage: In console, run: window['authService'].inspectToken()
   */
  public inspectToken(): void {
    const token = this.getAccessToken();
    if (!token) {
      console.log('❌ No access token found');
      return;
    }

    const payload = this.decodeToken(token);
    console.log('🔍 Current Access Token Info:');
    console.log('  Token UID:', payload.token_uid);
    console.log('  Expires At:', new Date(payload.exp * 1000).toISOString());
    console.log('  Issued At:', new Date(payload.iat * 1000).toISOString());
    console.log('  User/Client UID:', payload.user_uid || payload.client_uid);
    console.log('  Full Token (first 50 chars):', token.substring(0, 50) + '...');
    console.log('  Full Payload:', payload);
  }

  // Private helper methods

  private handleLoginSuccess(response: LoginResponse): Observable<User | Client> {
    // CRITICAL: Clear old auth data first to prevent token conflicts
    this.clearAuthData();

    const authData: AuthData = {
      entityType: response.data.entity_type,
      entity: {} as any, // Will be populated by getCurrentEntity() call
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: response.data.expires_at
    };

    this.storeAuthData(authData);
    this.entityTypeSubject.next(response.data.entity_type);

    // Start refresh token timer
    this.startRefreshTokenTimer(response.data.expires_at);

    // Load AppSettings after successful login
    // This will fetch entity, currency, store, price type in one call
    this.appSettingsService.loadSettings().subscribe({
      next: (settings) => {
        // Update current entity from AppSettings
        if (settings.entity) {
          this.currentEntitySubject.next(settings.entity);
        }
      },
      error: (error) => {
        console.error('Failed to load app settings after login:', error);
        // Continue with getCurrentEntity() as fallback
      }
    });

    return this.getCurrentEntity();
  }

  private clearAuthData(): void {
    localStorage.removeItem(this.AUTH_DATA_KEY);
    this.currentEntitySubject.next(null);
    this.entityTypeSubject.next(null);
    this.stopRefreshTokenTimer();
    // Clear AppSettings on logout
    this.appSettingsService.clearSettings();
  }

  private storeAuthData(authData: AuthData): void {
    localStorage.setItem(this.AUTH_DATA_KEY, JSON.stringify(authData));
  }

  private getStoredAuthData(): AuthData | null {
    const stored = localStorage.getItem(this.AUTH_DATA_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  private startRefreshTokenTimer(expiresAt: string): void {
    // Stop any existing timer
    this.stopRefreshTokenTimer();

    // Calculate time until token expires
    const expires = new Date(expiresAt);
    const now = new Date();
    const timeout = expires.getTime() - now.getTime();

    // Refresh token 1 minute before it expires
    const refreshTime = timeout - (60 * 1000);

    if (refreshTime > 0) {
      this.refreshTokenTimeout = setTimeout(() => {
        this.refreshToken().subscribe({
          error: (error) => {
            console.error('Auto token refresh failed:', error);
            // Will be handled by interceptor and redirect to login
          }
        });
      }, refreshTime);
    }
  }

  private stopRefreshTokenTimer(): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
      this.refreshTokenTimeout = undefined;
    }
  }

  /**
   * Decode JWT token to extract payload (for debugging)
   */
  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Failed to decode token:', error);
      return {};
    }
  }
}
