import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Client API management: the admin side of the machine-to-machine API clients
 * integrate their systems with (/api/client/v1). Keys, access gates, request
 * log, usage and settings.
 */

export const CLIENT_API_SCOPES = [
  'catalog:read',
  'orders:read',
  'orders:write',
  'profile:read',
  'profile:write'
] as const;
export type ClientAPIScope = typeof CLIENT_API_SCOPES[number];

export interface ClientAPISettings {
  id: number;
  enabled: boolean;
  stores_enabled_by_default: boolean;
  self_service_enabled: boolean;
  max_keys_per_client: number;
  default_key_ttl_days: number;
  max_key_ttl_days: number;
  default_read_rpm: number;
  default_write_rpm: number;
  rotation_grace_hours: number;
  request_log_retention_days: number;
  usage_retention_days: number;
  expiry_warn_days: number;
  alert_key_events: boolean;
  auth_failure_limit: number;
  auth_failure_window_minutes: number;
  created_at?: string;
  last_update?: string;
}

export type ClientAPISettingsUpdate = Partial<Omit<ClientAPISettings, 'id' | 'created_at' | 'last_update'>>;

export interface ClientAPIStoreAccess {
  store_uid: string;
  enabled: boolean;
  last_update?: string;
}

export interface ClientAPIClientAccess {
  client_uid: string;
  enabled: boolean;
  updated_by?: string;
  last_update?: string;
}

export interface ClientAPIKey {
  uid: string;
  client_uid: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: 'active' | 'revoked';
  is_test: boolean;
  expires_at: string;
  last_used_at?: string;
  last_used_ip?: string;
  created_by_type: 'user' | 'client';
  created_by_uid: string;
  created_at: string;
  revoked_at?: string;
  revoked_by?: string;
  revoked_reason?: string;
  rotated_from_uid?: string;
  rate_limit_read?: number;
  rate_limit_write?: number;
  last_update: string;
}

export interface ClientAPIKeyListItem extends ClientAPIKey {
  client_name: string;
  store_uid: string;
  requests_24h: number;
  requests_7d: number;
  errors_24h: number;
  display_label: string;
}

export interface ClientAPIKeyCreated {
  key: ClientAPIKey;
  plaintext_key: string;
}

export interface ClientAPIKeyCreateRequest {
  client_uid: string;
  name: string;
  scopes: string[];
  is_test: boolean;
  ttl_days?: number;
  rate_limit_read?: number;
  rate_limit_write?: number;
}

export interface ClientAPIKeyUpdateRequest {
  uid: string;
  name?: string;
  scopes?: string[];
  is_test?: boolean;
  expires_at?: string;
  rate_limit_read?: number;
  rate_limit_write?: number;
}

export interface ClientAPIKeyFilter {
  client_uid?: string;
  store_uid?: string;
  status?: 'active' | 'revoked' | 'expired' | '';
  scope?: string;
  is_test?: boolean | null;
  expiring_days?: number | null;
  search?: string;
}

export interface ClientAPIRequestRow {
  id: number;
  timestamp: string;
  request_id: string;
  key_uid: string;
  client_uid: string;
  ip_address: string;
  method: string;
  path: string;
  route: string;
  status_code: number;
  duration_ms: number;
  bytes_out: number;
  is_test: boolean;
  error_code?: string;
}

export interface ClientAPIRequestFilter {
  key_uid?: string;
  client_uid?: string;
  store_uid?: string;
  request_id?: string;
  route?: string;
  status_min?: number | null;
  status_max?: number | null;
  from?: string;
  to?: string;
}

export interface ClientAPIUsageHour {
  hour: string;
  key_uid: string;
  client_uid: string;
  route: string;
  requests: number;
  status_2xx: number;
  status_4xx: number;
  status_429: number;
  status_5xx: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  bytes_out: number;
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  pagination?: { page: number; count: number; total: number; total_pages: number };
}

@Injectable({ providedIn: 'root' })
export class ClientApiService {
  private readonly base = `${environment.apiUrl}/admin/client-api`;

  constructor(private http: HttpClient) {}

  // ---- settings & gates ----

  getSettings(): Observable<ClientAPISettings> {
    return this.http.get<any>(`${this.base}/settings`).pipe(map(r => r.data));
  }

  updateSettings(update: ClientAPISettingsUpdate): Observable<ClientAPISettings> {
    return this.http.put<any>(`${this.base}/settings`, { data: update }).pipe(map(r => r.data));
  }

  listStoreAccess(): Observable<ClientAPIStoreAccess[]> {
    return this.http.get<any>(`${this.base}/stores`).pipe(map(r => r.data || []));
  }

  setStoreAccess(storeUid: string, enabled: boolean): Observable<ClientAPIStoreAccess> {
    return this.http.put<any>(`${this.base}/stores`, { data: { store_uid: storeUid, enabled } }).pipe(map(r => r.data));
  }

  getClientAccess(clientUid: string): Observable<ClientAPIClientAccess> {
    return this.http.get<any>(`${this.base}/clients/${encodeURIComponent(clientUid)}/access`).pipe(map(r => r.data));
  }

  setClientAccess(clientUid: string, enabled: boolean): Observable<ClientAPIClientAccess> {
    return this.http.put<any>(`${this.base}/clients/access`, { data: { client_uid: clientUid, enabled } }).pipe(map(r => r.data));
  }

  // ---- keys ----

  listKeys(filter: ClientAPIKeyFilter, offset = 0, limit = 50): Observable<Paginated<ClientAPIKeyListItem>> {
    let params = new HttpParams().set('offset', offset).set('limit', limit);
    if (filter.client_uid) params = params.set('client_uid', filter.client_uid);
    if (filter.store_uid) params = params.set('store_uid', filter.store_uid);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.scope) params = params.set('scope', filter.scope);
    if (filter.is_test !== null && filter.is_test !== undefined) params = params.set('is_test', String(filter.is_test));
    if (filter.expiring_days) params = params.set('expiring_days', filter.expiring_days);
    if (filter.search) params = params.set('search', filter.search);
    return this.http.get<Paginated<ClientAPIKeyListItem>>(`${this.base}/keys`, { params });
  }

  createKey(req: ClientAPIKeyCreateRequest): Observable<ClientAPIKeyCreated> {
    return this.http.post<any>(`${this.base}/keys`, { data: req }).pipe(map(r => r.data));
  }

  updateKey(req: ClientAPIKeyUpdateRequest): Observable<ClientAPIKey> {
    return this.http.put<any>(`${this.base}/keys`, { data: req }).pipe(map(r => r.data));
  }

  revokeKey(uid: string, reason: string): Observable<ClientAPIKey> {
    return this.http.post<any>(`${this.base}/keys/revoke`, { data: { uid, reason } }).pipe(map(r => r.data));
  }

  rotateKey(uid: string): Observable<ClientAPIKeyCreated> {
    return this.http.post<any>(`${this.base}/keys/rotate`, { data: { uid } }).pipe(map(r => r.data));
  }

  // ---- telemetry ----

  listRequests(filter: ClientAPIRequestFilter, offset = 0, limit = 50): Observable<Paginated<ClientAPIRequestRow>> {
    let params = new HttpParams().set('offset', offset).set('limit', limit);
    const set = (k: string, v: any) => { if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v)); };
    set('key_uid', filter.key_uid);
    set('client_uid', filter.client_uid);
    set('store_uid', filter.store_uid);
    set('request_id', filter.request_id);
    set('route', filter.route);
    set('status_min', filter.status_min);
    set('status_max', filter.status_max);
    set('from', filter.from);
    set('to', filter.to);
    return this.http.get<Paginated<ClientAPIRequestRow>>(`${this.base}/requests`, { params });
  }

  listUsage(filter: { key_uid?: string; client_uid?: string; store_uid?: string; from?: string; to?: string }): Observable<ClientAPIUsageHour[]> {
    let params = new HttpParams();
    const set = (k: string, v: any) => { if (v) params = params.set(k, String(v)); };
    set('key_uid', filter.key_uid);
    set('client_uid', filter.client_uid);
    set('store_uid', filter.store_uid);
    set('from', filter.from);
    set('to', filter.to);
    return this.http.get<any>(`${this.base}/usage`, { params }).pipe(map(r => r.data || []));
  }
}
