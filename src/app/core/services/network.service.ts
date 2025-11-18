import { Injectable } from '@angular/core';
import { Observable, fromEvent, merge } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

/**
 * Service for monitoring network connectivity status
 * Provides observables and synchronous methods to check online/offline state
 */
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
   * @returns Observable<boolean> - Emits network status changes
   */
  get isOnline$(): Observable<boolean> {
    return this.online$;
  }

  /**
   * Get current online status synchronously
   * @returns boolean - True if online, false if offline
   */
  get isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Observable that emits true when offline, false when online
   * @returns Observable<boolean> - Emits inverted network status
   */
  get isOffline$(): Observable<boolean> {
    return this.online$.pipe(
      map(online => !online)
    );
  }
}

