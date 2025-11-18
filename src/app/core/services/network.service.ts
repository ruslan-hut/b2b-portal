import { Injectable } from '@angular/core';
import { Observable, fromEvent, merge, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private online$: Observable<boolean>;

  constructor() {
    // Create observables for online/offline events
    const onlineEvent$ = fromEvent(window, 'online').pipe(map(() => true));
    const offlineEvent$ = fromEvent(window, 'offline').pipe(map(() => false));

    // Merge events with initial state
    this.online$ = merge(
      onlineEvent$,
      offlineEvent$
    ).pipe(
      startWith(navigator.onLine)
    );
  }

  /**
   * Observable that emits true when online, false when offline
   */
  get isOnline$(): Observable<boolean> {
    return this.online$;
  }

  /**
   * Get current online status synchronously
   */
  get isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Observable that emits true when offline, false when online
   */
  get isOffline$(): Observable<boolean> {
    return this.online$.pipe(
      map(online => !online)
    );
  }
}

