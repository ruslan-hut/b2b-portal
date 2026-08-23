import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap, take } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Maintenance } from '../services/maintenance';
import { ChatSettingsService } from '../../admin/chat/services/chat-settings.service';

// Single in-flight token refresh shared across concurrent 401s. Every waiting
// request subscribes to the SAME observable, so they all receive the refreshed
// token on success OR the error on failure — the latter is critical: the old
// BehaviorSubject approach never signalled failure, leaving concurrent requests
// hanging forever (spinners that never resolve). Reset to null when the refresh
// settles so the next 401 triggers a fresh refresh.
let refreshInFlight$: Observable<string> | null = null;

function addToken(
  request: HttpRequest<unknown>,
  token: string,
  chatBaseUrl: string | null
): HttpRequest<unknown> {
  // Don't add token to login/refresh endpoints or external chat service requests.
  // SECURITY: startsWith() for chatBaseUrl, not includes() — substring match
  // could allow URL spoofing (e.g. attacker.com?q=chatBaseUrl).
  if (
    request.url.includes('/auth/login') ||
    request.url.includes('/auth/refresh') ||
    (chatBaseUrl && request.url.startsWith(chatBaseUrl))
  ) {
    return request;
  }

  return request.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });
}

function isAuthorizationError(error: HttpErrorResponse): boolean {
  const message = error?.error?.message;
  if (!message) return false;
  const lower = String(message).toLowerCase();
  return (
    lower.includes('not a client') ||
    lower.includes('not authenticated or not a client') ||
    lower.includes('access denied') ||
    lower.includes('forbidden')
  );
}

function handle401(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  error: HttpErrorResponse,
  authService: AuthService,
  router: Router,
  chatBaseUrl: string | null
): Observable<HttpEvent<unknown>> {
  if (request.url.includes('/auth/login') || request.url.includes('/auth/refresh')) {
    router.navigate(['/auth/login']);
    return throwError(() => error);
  }

  if (isAuthorizationError(error)) {
    return throwError(() => error);
  }

  if (!refreshInFlight$) {
    refreshInFlight$ = authService.refreshToken().pipe(
      map((response: any) => response.data.access_token as string),
      catchError(err => {
        // Redirect once; the error is replayed to every waiting request below,
        // so none are left hanging.
        router.navigate(['/auth/login']);
        return throwError(() => err);
      }),
      // Clear the shared refresh once it settles so a later 401 refreshes anew.
      finalize(() => { refreshInFlight$ = null; }),
      shareReplay(1)
    );
  }

  return refreshInFlight$.pipe(
    take(1),
    switchMap(token => next(addToken(request, token, chatBaseUrl)))
  );
}

// Both codes mean "this session must stop": MAINTENANCE takes the whole
// platform down, CLIENT_ACCESS_DENIED cuts off clients only. In either case a
// client is signed out; staff stay logged in.
function isMaintenanceError(error: HttpErrorResponse): boolean {
  const code = error?.error?.error?.code;
  return error.status === 503 && (code === 'MAINTENANCE' || code === 'CLIENT_ACCESS_DENIED');
}

function handleMaintenance(
  error: HttpErrorResponse,
  authService: AuthService,
  router: Router,
  maintenance: Maintenance
): void {
  // Refresh status so banner reflects reality without waiting for the next poll.
  maintenance.refresh().subscribe();

  // Clients are signed out; managers stay logged in and rely on the banner.
  if (authService.entityTypeValue === 'client') {
    authService.logout().subscribe({
      complete: () => router.navigate(['/auth/login']),
      error: () => router.navigate(['/auth/login'])
    });
  }
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const maintenance = inject(Maintenance);
  const chatSettings = inject(ChatSettingsService);
  const chatBaseUrl = chatSettings.getBaseUrl();

  const token = authService.getAccessToken();
  if (token) {
    request = addToken(request, token, chatBaseUrl);
  }

  return next(request).pipe(
    catchError(error => {
      if (error instanceof HttpErrorResponse) {
        if (isMaintenanceError(error)) {
          handleMaintenance(error, authService, router, maintenance);
          return throwError(() => error);
        }
        if (error.status === 401) {
          return handle401(request, next, error, authService, router, chatBaseUrl);
        }
      }
      return throwError(() => error);
    })
  );
};
