/**
 * Admin session viewer models. Mirrors backend/entity/session.go and the
 * runtime snapshot in backend/internal/http-server/handlers/admin/runtime.go.
 */

export type SessionEntityType = 'user' | 'client';

export type SessionStatus = 'active' | 'idle' | 'expired' | 'revoked';

/**
 * One persisted session (a `user_auth` row) joined with the account behind it.
 *
 * Two fields do not mean what their names suggest, because of how the backend
 * issues tokens:
 *
 * - `expires_at` is the *refresh* expiry (7 days), not the access-token expiry
 *   (12 hours). It is when the session dies for good if left untouched.
 * - `issued_at` is when this token row was minted. Refresh rotation resets it
 *   roughly every access-token lifetime, so it is not the moment the person
 *   logged in and must not be labelled as one.
 */
export interface SessionInfo {
  token_uid: string;
  entity_type: SessionEntityType;
  entity_uid: string;
  username?: string;
  /** "first last" for staff, company name for clients. */
  display_name?: string;
  /** Staff role; empty for clients. */
  role?: string;
  store_uid?: string;
  issued_at: string;
  expires_at: string;
  /** Bumped by the backend on every authenticated request. */
  last_used: string;
  is_revoked: boolean;
  user_agent?: string;
  ip_address?: string;
  /** True for the session the viewing admin is currently holding. */
  is_current: boolean;
  status: SessionStatus;
}

/** One hour of the session-start histogram. */
export interface SessionHourBucket {
  hour: string;
  count: number;
}

/** Aggregate counters behind the dashboard tiles. */
export interface SessionStats {
  /** Sessions that made a request in the last 5 minutes. */
  active_sessions: number;
  active_staff: number;
  active_clients: number;
  /** Distinct accounts among the active sessions. */
  active_accounts: number;
  /** Sessions that are neither revoked nor expired, however quiet. */
  live_sessions: number;
  live_staff: number;
  live_clients: number;
  distinct_ips: number;
  started_last_24h: number;
  hourly: SessionHourBucket[];
}

/** Per-route totals accumulated since the backend process started. */
export interface RouteStats {
  route: string;
  count: number;
  avg_ms: number;
  max_ms: number;
  errors: number;
}

/** Request traffic over a trailing window. */
export interface WindowStats {
  window_minutes: number;
  requests: number;
  requests_per_min: number;
  avg_ms: number;
  max_ms: number;
  /** Histogram estimates, reported as the bucket's upper edge. */
  p50_ms: number;
  p95_ms: number;
  status: Record<string, number>;
  /** Share of 4xx + 5xx responses, 0-1. */
  error_rate: number;
}

/**
 * Connection pool state. `wait_count` climbing while you watch is the clearest
 * signal that the pool, not the application, is the bottleneck.
 */
export interface DBPoolStats {
  driver: string;
  max_open: number;
  open: number;
  in_use: number;
  idle: number;
  wait_count: number;
  wait_duration_ms: number;
  max_idle_closed: number;
  max_idle_time_closed: number;
  max_lifetime_closed: number;
}

export interface GoRuntimeStats {
  goroutines: number;
  version: string;
  num_cpu: number;
  heap_alloc_mb: number;
  heap_sys_mb: number;
  sys_mb: number;
  num_gc: number;
  last_gc_pause_ms: number;
}

export interface RuntimeMetrics {
  uptime_seconds: number;
  in_flight: number;
  total_requests: number;
  window: WindowStats;
  routes: RouteStats[];
  routes_truncated: boolean;
}

/**
 * Runtime state of one backend instance. Behind a load balancer each instance
 * reports only its own share, and every counter resets when it restarts.
 */
export interface RuntimeSnapshot {
  metrics: RuntimeMetrics;
  go: GoRuntimeStats;
  /** Null when the backend is running without a database. */
  db: DBPoolStats | null;
}

/** Filters accepted by GET /admin/sessions. */
export interface SessionFilters {
  entity_type?: SessionEntityType | '';
  status?: SessionStatus | '';
  search?: string;
}
