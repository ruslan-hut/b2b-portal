import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription, timer } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { CrmService, CrmBoardChanges } from './crm.service';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CrmPollingService implements OnDestroy {
  // Backoff configuration
  private readonly baseInterval = 10000;      // 10s initial
  private readonly maxInterval = 60000;       // 60s max
  private readonly maxConsecutiveErrors = 5;  // Stop after 5 failures

  private lastCheckedAt: string | null = null;
  private pollingSubscription: Subscription | null = null;
  private changesSubject = new Subject<CrmBoardChanges>();
  private currentStoreUid: string | undefined;
  private consecutiveErrors = 0;
  private currentInterval = this.baseInterval;

  changes$ = this.changesSubject.asObservable();

  constructor(private crmService: CrmService) {}

  ngOnDestroy(): void {
    this.stopPolling();
  }

  startPolling(storeUid?: string): void {
    // Stop any existing polling
    this.stopPolling();

    // Reset error tracking and interval
    this.consecutiveErrors = 0;
    this.currentInterval = this.baseInterval;

    // Set current store and initialize last checked time
    this.currentStoreUid = storeUid;
    this.lastCheckedAt = new Date().toISOString();

    // Start first poll
    this.schedulePoll();
  }

  private schedulePoll(): void {
    this.pollingSubscription = timer(this.currentInterval)
      .pipe(
        switchMap(() => this.checkForChanges())
      )
      .subscribe({
        next: (changes) => {
          // Success - reset backoff
          this.consecutiveErrors = 0;
          this.currentInterval = this.baseInterval;

          if (changes.has_changes) {
            this.changesSubject.next(changes);
            // Update last checked time to the latest change
            if (changes.last_change_at) {
              this.lastCheckedAt = changes.last_change_at;
            }
          }

          // Schedule next poll
          this.schedulePoll();
        },
        error: (err) => {
          console.error('Polling error:', err);

          // Increment error counter
          this.consecutiveErrors++;

          // Calculate exponential backoff: min(maxInterval, baseInterval * 2^errors)
          const backoffMultiplier = Math.pow(2, Math.min(this.consecutiveErrors, 5));
          this.currentInterval = Math.min(this.maxInterval, this.baseInterval * backoffMultiplier);

          console.warn(`Polling backoff: ${this.currentInterval}ms (${this.consecutiveErrors} consecutive errors)`);

          // Stop polling after max consecutive errors
          if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
            console.error('Max consecutive errors reached. Stopping polling.');
            this.stopPolling();
            return;
          }

          // Schedule next poll with backoff
          this.schedulePoll();
        }
      });
  }

  stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
    this.lastCheckedAt = null;
    this.consecutiveErrors = 0;
    this.currentInterval = this.baseInterval;
  }

  /**
   * Reset the last checked timestamp to current time.
   * Call this after manually refreshing the board to avoid
   * detecting the same changes again.
   */
  resetLastChecked(): void {
    this.lastCheckedAt = new Date().toISOString();
  }

  /**
   * Get current polling state for debugging.
   */
  getPollingState(): {
    isActive: boolean;
    currentInterval: number;
    consecutiveErrors: number;
    lastCheckedAt: string | null;
  } {
    return {
      isActive: this.pollingSubscription !== null,
      currentInterval: this.currentInterval,
      consecutiveErrors: this.consecutiveErrors,
      lastCheckedAt: this.lastCheckedAt
    };
  }

  private checkForChanges() {
    if (!this.lastCheckedAt) {
      this.lastCheckedAt = new Date().toISOString();
    }

    return this.crmService.checkForChanges(this.lastCheckedAt, this.currentStoreUid).pipe(
      catchError((err) => {
        console.error('Error checking for changes:', err);
        // Return empty changes on error to avoid breaking the polling
        return of({
          last_change_at: '',
          has_changes: false,
          affected_stages: [],
          change_count: 0
        } as CrmBoardChanges);
      })
    );
  }
}
