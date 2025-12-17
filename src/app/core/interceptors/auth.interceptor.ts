import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Add auth token to request if available
    const token = this.authService.getAccessToken();
    if (token) {
      request = this.addToken(request, token);
    }

    return next.handle(request).pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.handle401Error(request, next, error);
        }
        return throwError(() => error);
      })
    );
  }

  private addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
    // Don't add token to login and refresh endpoints
    if (request.url.includes('/auth/login') || request.url.includes('/auth/refresh')) {
      return request;
    }

    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler, error: HttpErrorResponse): Observable<HttpEvent<any>> {
    // Don't try to refresh on login or refresh endpoints
    if (request.url.includes('/auth/login') || request.url.includes('/auth/refresh')) {
      this.router.navigate(['/auth/login']);
      return throwError(() => error);
    }

    // Check if this is an authorization error (not authentication)
    // Authorization errors (like "not a client") should not trigger token refresh
    // Only authentication errors (token expired/revoked) should trigger refresh
    if (error?.error?.message) {
      const errorMessage = error.error.message.toLowerCase();
      // If error is about authorization/permissions (not token), don't refresh
      if (errorMessage.includes('not a client') || 
          errorMessage.includes('not authenticated or not a client') ||
          errorMessage.includes('access denied') ||
          errorMessage.includes('forbidden')) {
        // This is an authorization error, not authentication - don't refresh token
        return throwError(() => error);
      }
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap((response: any) => {
          this.isRefreshing = false;
          const newToken = response.data.access_token;
          // Ensure token is stored before notifying other requests
          this.refreshTokenSubject.next(newToken);
          // Use the new token from the response (already stored by handleLoginSuccess)
          return next.handle(this.addToken(request, newToken));
        }),
        catchError((err) => {
          this.isRefreshing = false;
          // Redirect to login if refresh fails
          this.router.navigate(['/auth/login']);
          return throwError(() => err);
        })
      );
    } else {
      // Wait for refresh to complete
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(token => {
          return next.handle(this.addToken(request, token));
        })
      );
    }
  }
}
