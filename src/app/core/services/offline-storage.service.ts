import { Injectable } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
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
export class OfflineStorageService {
  private pendingActions: PendingAction[] = [];

  constructor(private networkService: NetworkService) {
    this.loadPendingActions();
    
    // Watch for online status and sync when back online
    this.networkService.isOnline$.subscribe(isOnline => {
      if (isOnline && this.pendingActions.length > 0) {
        this.syncPendingActions();
      }
    });
  }

  /**
   * Queue an action to be executed when online
   */
  queueAction<T>(type: 'order', data: CreateOrderRequest): Observable<T> {
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
          return of(null as any);
        })
      );
    }

    // Return observable that resolves when action is queued
    return of(null as any);
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
   */
  private syncPendingActions(): Observable<any> {
    if (!this.networkService.isOnline || this.pendingActions.length === 0) {
      return of(null);
    }

    // This will be called by the service that actually performs the action
    // For now, we just return an observable
    return of(null);
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
   */
  private generateId(): string {
    return `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

