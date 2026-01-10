import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LogEntry {
  id: number;
  time: string;
  level: string;
  user_uid?: string;
  request_id?: string;
  message: string;
  extra?: string;
}

export interface LogsResponse {
  success: boolean;
  data: LogEntry[];
  metadata?: {
    page: number;
    count: number;
    total: number;
    total_pages: number;
  };
}

export interface LogFilters {
  level?: string;
  user_uid?: string;
  request_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * List logs with filters and pagination
   */
  listLogs(
    page: number = 1,
    count: number = 50,
    filters?: LogFilters
  ): Observable<LogsResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());

    if (filters) {
      if (filters.level) {
        params = params.set('level', filters.level);
      }
      if (filters.user_uid) {
        params = params.set('user_uid', filters.user_uid);
      }
      if (filters.request_id) {
        params = params.set('request_id', filters.request_id);
      }
      if (filters.date_from) {
        params = params.set('date_from', filters.date_from);
      }
      if (filters.date_to) {
        params = params.set('date_to', filters.date_to);
      }
      if (filters.search) {
        params = params.set('search', filters.search);
      }
    }

    return this.http.get<LogsResponse>(`${this.apiUrl}/admin/logs`, { params });
  }

  /**
   * Cleanup old logs
   */
  cleanupLogs(retentionDays?: number): Observable<any> {
    let params = new HttpParams();
    if (retentionDays) {
      params = params.set('retention_days', retentionDays.toString());
    }
    return this.http.delete<any>(`${this.apiUrl}/admin/logs/cleanup`, { params });
  }
}

