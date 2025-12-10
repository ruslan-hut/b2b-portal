import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { PriceType } from '../models/price-type.model';
import { environment } from '../../../environments/environment';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class PriceTypeService {
  private priceTypesCache$: Observable<{ [uid: string]: PriceType }> | undefined;

  constructor(private http: HttpClient) {}

  getPriceTypes(): Observable<{ [uid: string]: PriceType }> {
    if (!this.priceTypesCache$) {
      this.priceTypesCache$ = this.http.get<ApiResponse<PriceType[]>>(`${environment.apiUrl}/price_type`).pipe(
        map(response => {
          const priceTypes = response.data || [];
          return priceTypes.reduce((acc, priceType) => {
            acc[priceType.uid] = priceType;
            return acc;
          }, {} as { [uid: string]: PriceType });
        }),
        shareReplay(1)
      );
    }
    return this.priceTypesCache$;
  }

  getPriceTypesByUids(uids: string[]): Observable<{ [uid: string]: PriceType }> {
    if (uids.length === 0) {
      return of({});
    }
    return this.getPriceTypes().pipe(
      map(priceTypes => {
        const result: { [uid: string]: PriceType } = {};
        for (const uid of uids) {
          if (priceTypes[uid]) {
            result[uid] = priceTypes[uid];
          }
        }
        return result;
      })
    );
  }
}
