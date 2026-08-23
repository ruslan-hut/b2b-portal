import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import {
  RuntimeSnapshot,
  SessionEntityType,
  SessionFilters,
  SessionInfo,
  SessionStats
} from '../models/session.model';

/**
 * Admin session viewer API. Every endpoint here is admin-only on the backend:
 * the rows carry each customer's IP address and device string.
 *
 * Not to be confused with GET /auth/tokens, which lists only the caller's own
 * sessions and is available to any authenticated entity.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly baseUrl = `${environment.apiUrl}/admin/sessions`;

  constructor(private http: HttpClient) {}

  /** One page of sessions, most recently active first. */
  list(filters: SessionFilters, page: number, count: number): Observable<ApiResponse<SessionInfo[]>> {
    let params = new HttpParams()
      .set('page', page)
      .set('count', count);

    if (filters.entity_type) {
      params = params.set('entity_type', filters.entity_type);
    }
    if (filters.status) {
      params = params.set('status', filters.status);
    }
    if (filters.search?.trim()) {
      params = params.set('search', filters.search.trim());
    }

    return this.http.get<ApiResponse<SessionInfo[]>>(this.baseUrl, { params });
  }

  /** Aggregate counters for the dashboard tiles. */
  stats(): Observable<ApiResponse<SessionStats>> {
    return this.http.get<ApiResponse<SessionStats>>(`${this.baseUrl}/stats`);
  }

  /**
   * Revokes specific sessions. Takes effect on the revoked session's next
   * request, whatever time its JWT has left.
   */
  revoke(tokenUids: string[]): Observable<ApiResponse<{ revoked: number }>> {
    return this.http.post<ApiResponse<{ revoked: number }>>(`${this.baseUrl}/revoke`, { token_uids: tokenUids });
  }

  /** Revokes every session belonging to one account. */
  revokeAccount(entityType: SessionEntityType, entityUid: string): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>(`${this.baseUrl}/revoke`, {
      entity_type: entityType,
      entity_uid: entityUid
    });
  }

  /**
   * Runtime state of the backend instance that answers this call — request
   * rates, latency, connection pool and process health.
   */
  runtime(windowMinutes = 5): Observable<ApiResponse<RuntimeSnapshot>> {
    const params = new HttpParams().set('window_minutes', windowMinutes);
    return this.http.get<ApiResponse<RuntimeSnapshot>>(`${environment.apiUrl}/admin/runtime`, { params });
  }
}
