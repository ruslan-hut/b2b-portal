import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Currency } from '../models/currency.model';
import { ApiResponse } from '../models/api.model';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getCurrencies(): Observable<Currency[]> {
    // Backend list endpoint is GET /currency/ (paginated). Request a generous
    // page so we get every currency a single call.
    const url = `${this.apiUrl}/currency/?count=500`;
    return this.http.get<ApiResponse<Currency[]>>(url).pipe(
      map(response => response.data || []),
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
}
