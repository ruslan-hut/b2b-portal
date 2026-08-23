import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';

export interface MaintenanceStatus {
  enabled: boolean;
  message?: string;
  endsAt?: number; // UTC milliseconds; 0 / undefined => no countdown
  // Sub-switches, independent of `enabled`: cut off client logins or external
  // API integrations without taking the whole platform down.
  denyClientLogin?: boolean;
  denyApiConnections?: boolean;
}

interface StatusResponse {
  success: boolean;
  data: {
    enabled: boolean;
    message?: string;
    ends_at?: number;
    deny_client_login?: boolean;
    deny_api_connections?: boolean;
  };
}

const POLL_INTERVAL_MS = 20_000;
const TICK_INTERVAL_MS = 1_000;
const EMPTY: MaintenanceStatus = { enabled: false };

@Injectable({ providedIn: 'root' })
export class Maintenance {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<MaintenanceStatus>(EMPTY);
  readonly enabled = computed(() => this.status().enabled);
  readonly message = computed(() => this.status().message ?? '');
  readonly endsAt = computed(() => this.status().endsAt ?? 0);
  readonly denyClientLogin = computed(() => this.status().denyClientLogin ?? false);
  readonly denyApiConnections = computed(() => this.status().denyApiConnections ?? false);

  // Tick signal updated once per second to drive the live countdown computed.
  private readonly now = signal(Date.now());

  // Human-readable countdown like "12:34" or "1:02:03"; null when no end time
  // or when maintenance is off.
  readonly countdown = computed<string | null>(() => {
    if (!this.enabled() || !this.endsAt()) return null;
    const remainingMs = this.endsAt() - this.now();
    if (remainingMs <= 0) return '0:00';
    return formatDuration(remainingMs);
  });

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  /**
   * Begin background polling. Called once from APP_INITIALIZER.
   * Safe to call multiple times - duplicate timers are guarded.
   */
  start(): void {
    if (this.pollHandle != null) return;

    // Initial fetch so the banner reflects state before the first poll fires.
    this.refresh().subscribe();

    this.pollHandle = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.refresh().subscribe();
      }
    }, POLL_INTERVAL_MS);

    this.tickHandle = setInterval(() => {
      if (this.enabled() && this.endsAt()) {
        this.now.set(Date.now());
      }
    }, TICK_INTERVAL_MS);

    this.destroyRef.onDestroy(() => {
      if (this.pollHandle) clearInterval(this.pollHandle);
      if (this.tickHandle) clearInterval(this.tickHandle);
    });
  }

  /**
   * Fetch the current state on demand (used by APP_INITIALIZER and by the
   * interceptor immediately after a 503 maintenance response).
   */
  refresh(): Observable<MaintenanceStatus> {
    return this.http.get<StatusResponse>(`${environment.apiUrl}/maintenance/status`).pipe(
      takeUntilDestroyed(this.destroyRef),
      map(resp => this.apply(resp)),
      catchError(() => of(this.status()))
    );
  }

  /** Admin write path: persist + refresh local state. */
  update(payload: {
    enabled: boolean;
    message: string;
    endsAt: number;
    denyClientLogin: boolean;
    denyApiConnections: boolean;
  }): Observable<MaintenanceStatus> {
    return this.http
      .put<StatusResponse>(`${environment.apiUrl}/admin/maintenance`, {
        enabled: payload.enabled,
        message: payload.message,
        ends_at: payload.endsAt,
        deny_client_login: payload.denyClientLogin,
        deny_api_connections: payload.denyApiConnections
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(resp => this.apply(resp))
      );
  }

  private apply(resp: StatusResponse | null | undefined): MaintenanceStatus {
    if (resp?.success && resp.data) {
      const next: MaintenanceStatus = {
        enabled: !!resp.data.enabled,
        message: resp.data.message ?? '',
        endsAt: resp.data.ends_at ?? 0,
        denyClientLogin: !!resp.data.deny_client_login,
        denyApiConnections: !!resp.data.deny_api_connections
      };
      this.status.set(next);
      this.now.set(Date.now());
      return next;
    }
    return this.status();
  }
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
