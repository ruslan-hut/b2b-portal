import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { Store } from '../models/store.model';
import { environment } from '../../../environments/environment';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class StoreService {
  private storesCache$: Observable<{ [uid: string]: Store }> | undefined;

  constructor(private http: HttpClient) {}

  getStores(): Observable<{ [uid: string]: Store }> {
    if (!this.storesCache$) {
      this.storesCache$ = this.http.get<ApiResponse<Store[]>>(`${environment.apiUrl}/store`).pipe(
        map(response => {
          const stores = response.data || [];
          return stores.reduce((acc, store) => {
            acc[store.uid] = store;
            return acc;
          }, {} as { [uid: string]: Store });
        }),
        shareReplay(1)
      );
    }
    return this.storesCache$;
  }

  getStoresByUids(uids: string[]): Observable<{ [uid: string]: Store }> {
    if (uids.length === 0) {
      return of({});
    }
    return this.getStores().pipe(
      map(stores => {
        const result: { [uid: string]: Store } = {};
        for (const uid of uids) {
          if (stores[uid]) {
            result[uid] = stores[uid];
          }
        }
        return result;
      })
    );
  }
}
