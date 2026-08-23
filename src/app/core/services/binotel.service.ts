import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Binotel telephony integration settings.
 *
 * The API secret is never sent to the browser — only `api_secret_masked` and
 * the `has_api_secret` flag. Sending the mask back on save is a no-op on the
 * server, so the form can round-trip it safely.
 */
export interface BinotelSettings {
  id: number;
  enabled: boolean;
  api_key: string;
  api_secret_masked: string;
  has_api_secret: boolean;
  company_id: string;
  default_pbx_number: string;
  default_country: string;
  webhook_ip_allowlist: string;
  caller_id_enabled: boolean;
  sticky_routing_enabled: boolean;
  call_log_enabled: boolean;
  click_to_call_enabled: boolean;
  missed_call_alerts_enabled: boolean;
  created_at: string;
  last_update: string;
}

export interface BinotelSettingsUpdate {
  enabled?: boolean;
  api_key?: string;
  api_secret?: string;
  company_id?: string;
  default_pbx_number?: string;
  default_country?: string;
  webhook_ip_allowlist?: string;
  caller_id_enabled?: boolean;
  sticky_routing_enabled?: boolean;
  call_log_enabled?: boolean;
  click_to_call_enabled?: boolean;
  missed_call_alerts_enabled?: boolean;
}

/** One PBX employee, joined with the Comex user mapped to their extension. */
export interface BinotelEmployee {
  employee_id: string;
  email: string;
  name: string;
  /** Empty when the employee has no SIP line and so cannot take calls. */
  internal_number: string;
  /** online | inuse | ringing | offline */
  status: string;
  role: string;
  mapped_user_uid?: string;
  mapped_user_name?: string;
}

export interface BinotelEmployeesResponse {
  employees: BinotelEmployee[];
  unmapped_users: number;
}

export interface BinotelConnectionTest {
  success: boolean;
  employee_count: number;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BinotelService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getSettings(): Observable<BinotelSettings> {
    return this.http
      .get<{ data: BinotelSettings }>(`${this.apiUrl}/admin/binotel/settings`)
      .pipe(map(response => response.data));
  }

  updateSettings(update: BinotelSettingsUpdate): Observable<BinotelSettings> {
    return this.http
      .put<{ data: BinotelSettings }>(`${this.apiUrl}/admin/binotel/settings`, { data: update })
      .pipe(map(response => response.data));
  }

  /** Verifies the stored credentials against the live PBX. */
  testConnection(): Observable<BinotelConnectionTest> {
    return this.http
      .post<{ data: BinotelConnectionTest }>(`${this.apiUrl}/admin/binotel/test`, {})
      .pipe(map(response => response.data));
  }

  listEmployees(): Observable<BinotelEmployeesResponse> {
    return this.http
      .get<{ data: BinotelEmployeesResponse }>(`${this.apiUrl}/admin/binotel/employees`)
      .pipe(map(response => response.data));
  }

  /** Binds a user to an extension. An empty internalNumber clears the mapping. */
  setUserMapping(userUid: string, internalNumber: string): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/admin/binotel/employees/mapping`, {
      data: { user_uid: userUid, internal_number: internalNumber }
    });
  }
}
