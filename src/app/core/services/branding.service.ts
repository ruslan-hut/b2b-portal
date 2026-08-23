import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import { AuthSettings } from '../models/auth-settings.model';

/**
 * Holds the configurable portal name ("site name") and keeps the browser tab
 * title and any subscribed UI (header, login page) in sync with it.
 *
 * The name is sourced from the public /auth/settings endpoint so it is
 * available before authentication. Falls back to the build-time appTitle.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly http = inject(HttpClient);
  private readonly titleService = inject(Title);
  private readonly apiUrl = environment.apiUrl;
  private readonly defaultName = environment.appTitle || 'B2B Portal';

  private readonly siteNameSubject = new BehaviorSubject<string>(this.defaultName);
  /** Emits the current site name; replays the latest value to new subscribers. */
  readonly siteName$ = this.siteNameSubject.asObservable();

  get siteName(): string {
    return this.siteNameSubject.value;
  }

  /**
   * Fetches the configured site name from the public settings endpoint and
   * applies it. Safe to call before login. Never throws.
   */
  load(): Observable<string> {
    return this.http.get<ApiResponse<AuthSettings>>(`${this.apiUrl}/auth/settings`).pipe(
      map(response => response.data?.site_name),
      tap(name => this.setSiteName(name)),
      map(() => this.siteName),
      catchError(() => of(this.siteName))
    );
  }

  /** Applies a new site name, falling back to the default when empty. */
  setSiteName(name?: string | null): void {
    const resolved = (name && name.trim()) || this.defaultName;
    if (resolved !== this.siteNameSubject.value) {
      this.siteNameSubject.next(resolved);
    }
    this.titleService.setTitle(resolved);
  }
}
