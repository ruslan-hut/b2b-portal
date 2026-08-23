import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';

/**
 * Generic base class for services that cache a UID-keyed lookup map from a list endpoint.
 * Subclasses only need to provide the API path and UID key function.
 *
 * Usage:
 *   export class StoreService extends CachedLookupService<Store> {
 *     constructor(http: HttpClient) {
 *       super(http, '/store', item => item.uid);
 *     }
 *   }
 */
export abstract class CachedLookupService<T> {
  private cache$: Observable<Record<string, T>> | undefined;

  protected constructor(
    private http: HttpClient,
    private apiPath: string,
    private getKey: (item: T) => string
  ) {}

  getAll(): Observable<Record<string, T>> {
    if (!this.cache$) {
      this.cache$ = this.http.get<ApiResponse<T[]>>(`${environment.apiUrl}${this.apiPath}`).pipe(
        map(response => {
          const items = response.data || [];
          return items.reduce((acc, item) => {
            acc[this.getKey(item)] = item;
            return acc;
          }, {} as Record<string, T>);
        }),
        // Reset the cache on error so a transient network failure does not get
        // replayed by shareReplay to every future subscriber for the rest of the
        // session. The next getAll() then retries with a fresh request.
        catchError(err => {
          this.cache$ = undefined;
          return throwError(() => err);
        }),
        shareReplay(1)
      );
    }
    return this.cache$;
  }

  getByUids(uids: string[]): Observable<Record<string, T>> {
    if (uids.length === 0) {
      return of({});
    }
    return this.getAll().pipe(
      map(all => {
        const result: Record<string, T> = {};
        for (const uid of uids) {
          if (all[uid]) {
            result[uid] = all[uid];
          }
        }
        return result;
      })
    );
  }

  invalidateCache(): void {
    this.cache$ = undefined;
  }
}
