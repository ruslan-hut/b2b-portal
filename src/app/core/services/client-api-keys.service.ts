import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ClientAPIKey, ClientAPIKeyCreated } from './client-api.service';

/** The client's own API keys (profile self-service, JWT session). */
export interface MyAPIKeys {
  keys: ClientAPIKey[];
  max_keys: number;
  active_keys: number;
  default_ttl_days: number;
  available_scopes: string[];
  docs_path: string;
  openapi_path: string;
  self_service: boolean;
}

@Injectable({ providedIn: 'root' })
export class ClientApiKeysService {
  private readonly base = `${environment.apiUrl}/frontend/profile/api-keys`;

  constructor(private http: HttpClient) {}

  list(): Observable<MyAPIKeys> {
    return this.http.get<any>(`${this.base}/`).pipe(map(r => r.data));
  }

  create(name: string, scopes: string[], isTest: boolean): Observable<ClientAPIKeyCreated> {
    return this.http.post<any>(`${this.base}/`, { name, scopes, is_test: isTest }).pipe(map(r => r.data));
  }

  rename(uid: string, name: string): Observable<ClientAPIKey> {
    return this.http.put<any>(`${this.base}/${encodeURIComponent(uid)}`, { name }).pipe(map(r => r.data));
  }

  revoke(uid: string): Observable<ClientAPIKey> {
    return this.http.post<any>(`${this.base}/${encodeURIComponent(uid)}/revoke`, {}).pipe(map(r => r.data));
  }

  rotate(uid: string): Observable<ClientAPIKeyCreated> {
    return this.http.post<any>(`${this.base}/${encodeURIComponent(uid)}/rotate`, {}).pipe(map(r => r.data));
  }
}
