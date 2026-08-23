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
  TokensListResponse,
  ApiResponse
} from '../models/user.model';
import { AuthSettings } from '../models/auth-settings.model';
import { environment } from '../../../environments/environment';
import { AppSettingsService } from './app-settings.service';
import { StoreService } from './store.service';
import { PriceTypeService } from './price-type.service';

interface AuthData {
  entityType: 'user' | 'client';
  entity: User | Client;
  accessToken: string;
  expiresAt: string;
  // The refresh token is intentionally NOT stored here: it lives only in an
  // httpOnly cookie set by the backend, out of reach of JavaScript/XSS.
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
    private appSettingsService: AppSettingsService,
    private storeService: StoreService,
    private priceTypeService: PriceTypeService
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
   * The current authenticated user, or null when the logged-in entity is a
   * client or nobody is logged in.
   */
  public get currentUser(): User | null {
    return this.entityTypeValue === 'user' ? (this.currentEntityValue as User) : null;
  }

  /**
   * True when the logged-in entity is an admin user.
   */
  public get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  /**
   * True when the logged-in user is bound to a single store (a store-scoped
   * manager). Such users may only see and act on their own store's data, so
   * the UI must not offer them a store selector. Admins and unbound users
   * are global and return false.
   *
   * Content editors are excluded even when they carry a store: for them the
   * binding is the catalog-preview context (which store's assortment and
   * prices the client-area preview shows), not a restriction. Mirrors
   * UserAuth.IsStoreScoped on the backend — keep the two in step.
   */
  public isStoreScopedManager(): boolean {
    const u = this.currentUser;
    return !!u && u.role !== 'admin' && u.role !== 'content_editor' && !!u.store_uid;
  }

  /**
   * The store UID a scoped user is locked to, or null for global users/admins.
   */
  public get scopedStoreUid(): string | null {
    return this.isStoreScopedManager() ? (this.currentUser!.store_uid ?? null) : null;
  }

  /**
   * Login with user credentials or client credentials
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    // withCredentials so the browser stores the httpOnly refresh cookie the
    // backend sets (required for cross-origin dev; harmless same-origin).
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials, { withCredentials: true }).pipe(
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

    return this.http.post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
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
    // The refresh token is sent automatically via the httpOnly cookie; no token
    // is read from or held in JS. withCredentials ensures the cookie is included.
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/refresh`, {}, { withCredentials: true }).pipe(
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
   * Fetch public auth flags (e.g. whether mail is enabled). Used by the login
   * page to decide whether to surface the "forgot password" link.
   */
  getAuthSettings(): Observable<AuthSettings> {
    return this.http.get<ApiResponse<AuthSettings>>(`${this.apiUrl}/auth/settings`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Initiate a password (user) or PIN (client) recovery flow.
   *
   * Pass either an email or a phone number (not both). Phone-based recovery is
   * client-only: the backend looks up the client by phone and sends the
   * recovery message to whatever email is on file for them.
   *
   * Always resolves successfully; the response message is intentionally
   * generic to prevent enumeration. Pass the user's currently selected UI
   * language so the recovery email is delivered in that language.
   */
  forgotPassword(
    identifier: { email?: string; phone?: string },
    language?: string
  ): Observable<{ message: string }> {
    const body: { email?: string; phone?: string; language?: string } = {};
    if (identifier.email) {
      body.email = identifier.email;
    }
    if (identifier.phone) {
      body.phone = identifier.phone;
    }
    if (language) {
      body.language = language;
    }
    return this.http.post<ApiResponse<{ message: string }>>(
      `${this.apiUrl}/auth/forgot-password`,
      body
    ).pipe(map(response => response.data));
  }

  /**
   * Complete a password reset using the token from the recovery email.
   */
  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<ApiResponse<{ message: string }>>(
      `${this.apiUrl}/auth/reset-password`,
      { token, new_password: newPassword }
    ).pipe(map(response => response.data));
  }

  /**
   * Change the password of the currently authenticated user from inside the app.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<ApiResponse<{ message: string }>>(
      `${this.apiUrl}/auth/change-password`,
      { current_password: currentPassword, new_password: newPassword }
    ).pipe(map(response => response.data));
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
   * Clear authentication data (public method for guards/interceptors)
   */
  public clearAuth(): void {
    this.clearAuthData();
  }

  // Private helper methods

  private handleLoginSuccess(response: LoginResponse): Observable<User | Client> {
    // CRITICAL: Clear old auth data first to prevent token conflicts
    this.clearAuthData();

    const authData: AuthData = {
      entityType: response.data.entity_type,
      entity: {} as any, // Will be populated by getCurrentEntity() call
      accessToken: response.data.access_token,
      expiresAt: response.data.expires_at
      // refresh token is delivered as an httpOnly cookie, not stored here
    };

    this.storeAuthData(authData);
    this.entityTypeSubject.next(response.data.entity_type);

    // Start refresh token timer
    this.startRefreshTokenTimer(response.data.expires_at);

    // getCurrentEntity() will load AppSettings and update entity state
    // This fetches entity, currency, store, price type in one call
    return this.getCurrentEntity();
  }

  private clearAuthData(): void {
    localStorage.removeItem(this.AUTH_DATA_KEY);
    this.currentEntitySubject.next(null);
    this.entityTypeSubject.next(null);
    this.stopRefreshTokenTimer();
    // Clear AppSettings on logout
    this.appSettingsService.clearSettings();
    // Drop cached reference data so a different user logging in on the same tab
    // can't transiently see the previous user's store / price-type lists.
    this.storeService.invalidateCache();
    this.priceTypeService.invalidateCache();
  }

  private storeAuthData(authData: AuthData): void {
    try {
      localStorage.setItem(this.AUTH_DATA_KEY, JSON.stringify(authData));
    } catch (error) {
      console.error('Failed to store auth data:', error);
      // Storage quota exceeded or other localStorage error
      // Continue without persisting - user will need to re-login on refresh
    }
  }

  private getStoredAuthData(): AuthData | null {
    try {
      const stored = localStorage.getItem(this.AUTH_DATA_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to parse stored auth data:', error);
      // Clear corrupted data
      localStorage.removeItem(this.AUTH_DATA_KEY);
    }
    return null;
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
}
