import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Currency } from '../models/currency.model';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getCurrencies(): Observable<Currency[]> {
    const url = `${this.apiUrl}/currency/list`;
    return this.http.get<ApiResponse<Currency[]>>(url).pipe(
      map(response => response.data),
      catchError(err => {
        console.error('[CurrencyService] error fetching currencies:', err);
        return of([]);
      })
    );
  }

  getCurrenciesByCodes(codes: string[]): Observable<Currency[]> {
    const url = `${this.apiUrl}/currency/batch`;
    return this.http.post<ApiResponse<Currency[]>>(url, { data: codes }).pipe(
      map(response => response.data),
      catchError(err => {
        console.error('[CurrencyService] error fetching currencies by codes:', err);
        return of([]);
      })
    );
  }

  /**
   * Get currency (code+name) for a client UID using backend helper endpoint.
   * Returns currency name string or null on failure.
   * @deprecated Use getCurrencyObjectForClient() instead to get full Currency object with sign
   */
  getCurrencyForClient(clientUid: string): Observable<string | null> {
    if (!clientUid) return of(null);
    const payload = { data: { client_uid: clientUid } };
    const url = `${this.apiUrl}/currency/names/client`;
    console.log('[CurrencyService] POST', url, 'payload=', payload);
    return this.http.post<ApiResponse<{ code: string; name: string; sign?: string }>>(url, payload).pipe(
      tap(resp => console.log('[CurrencyService] raw response (for client):', resp)),
      map(resp => {
        if (!resp || !resp.success || !resp.data) return null;
        return resp.data.name || resp.data.code || null;
      }),
      catchError(err => {
        console.error('[CurrencyService] error fetching currency for client:', err);
        return of(null);
      })
    );
  }

  /**
   * Get full Currency object for a client UID
   * Returns Currency object or null on failure
   */
  getCurrencyObjectForClient(clientUid: string): Observable<Currency | null> {
    if (!clientUid) return of(null);
    const payload = { data: { client_uid: clientUid } };
    const url = `${this.apiUrl}/currency/names/client`;
    console.log('[CurrencyService] POST', url, 'payload=', payload);
    return this.http.post<ApiResponse<Currency>>(url, payload).pipe(
      tap(resp => console.log('[CurrencyService] raw response (for client):', resp)),
      map(resp => {
        if (!resp || !resp.success || !resp.data) return null;
        return {
          code: resp.data.code,
          name: resp.data.name,
          sign: resp.data.sign || '',
          rate: resp.data.rate || 1
        };
      }),
      catchError(err => {
        console.error('[CurrencyService] error fetching currency for client:', err);
        return of(null);
      })
    );
  }
}
