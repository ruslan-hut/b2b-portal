import { Injectable, OnDestroy } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { NetworkService } from './network.service';
import { CreateOrderRequest } from '../models/order.model';

interface PendingAction {
  id: string;
  type: 'order';
  data: CreateOrderRequest;
  timestamp: number;
  retries: number;
}

const STORAGE_KEY = 'b2b_pending_actions';
const MAX_RETRIES = 3;

@Injectable({
  providedIn: 'root'
})
export class OfflineStorageService implements OnDestroy {
  private pendingActions: PendingAction[] = [];
  private networkSubscription?: Subscription;

  constructor(private networkService: NetworkService) {
    this.loadPendingActions();
    
    // Watch for online status and sync when back online
    this.networkSubscription = this.networkService.isOnline$.subscribe(isOnline => {
      if (isOnline && this.pendingActions.length > 0) {
        this.syncPendingActions();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.networkSubscription) {
      this.networkSubscription.unsubscribe();
    }
  }

  /**
   * Queue an action to be executed when online
   * @param type - Type of action to queue
   * @param data - Data for the action
   * @returns Observable that resolves when action is queued
   */
  queueAction(type: 'order', data: CreateOrderRequest): Observable<void> {
    const action: PendingAction = {
      id: this.generateId(),
      type,
      data,
      timestamp: Date.now(),
      retries: 0
    };

    this.pendingActions.push(action);
    this.savePendingActions();

    // If online, try to execute immediately
    if (this.networkService.isOnline) {
      return this.syncPendingActions().pipe(
        catchError(() => {
          // If sync fails, action remains in queue
          return of(undefined);
        })
      );
    }

    // Return observable that resolves when action is queued
    return of(undefined);
  }

  /**
   * Get all pending actions
   */
  getPendingActions(): PendingAction[] {
    return [...this.pendingActions];
  }

  /**
   * Check if there are pending actions
   */
  hasPendingActions(): boolean {
    return this.pendingActions.length > 0;
  }

  /**
   * Remove a pending action (after successful sync)
   */
  removePendingAction(actionId: string): void {
    this.pendingActions = this.pendingActions.filter(a => a.id !== actionId);
    this.savePendingActions();
  }

  /**
   * Clear all pending actions
   */
  clearPendingActions(): void {
    this.pendingActions = [];
    this.savePendingActions();
  }

  /**
   * Sync pending actions when online
   * @returns Observable that resolves when sync is attempted
   */
  private syncPendingActions(): Observable<void> {
    if (!this.networkService.isOnline || this.pendingActions.length === 0) {
      return of(undefined);
    }

    // This will be called by the service that actually performs the action
    // For now, we just return an observable
    return of(undefined);
  }

  /**
   * Load pending actions from localStorage
   */
  private loadPendingActions(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.pendingActions = JSON.parse(stored);
        // Remove actions older than 7 days
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        this.pendingActions = this.pendingActions.filter(
          action => action.timestamp > sevenDaysAgo
        );
        if (this.pendingActions.length !== JSON.parse(stored).length) {
          this.savePendingActions();
        }
      }
    } catch (error) {
      console.error('Error loading pending actions:', error);
      this.pendingActions = [];
    }
  }

  /**
   * Save pending actions to localStorage
   */
  private savePendingActions(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.pendingActions));
    } catch (error) {
      console.error('Error saving pending actions:', error);
    }
  }

  /**
   * Generate a unique ID for pending actions
   * @returns Unique identifier string
   */
  private generateId(): string {
    return `pending_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

