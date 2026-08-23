import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface AppNotification {
  id: number;
  type: NotificationType;
  /** Display text (already translated by the caller). */
  message: string;
  /** Auto-dismiss delay in ms; 0 keeps the toast until dismissed. */
  duration: number;
}

/**
 * App-wide non-blocking toast notifications. Replaces ad-hoc per-component
 * success/error banners and native alert() calls with a single consistent,
 * accessible surface. Callers pass already-translated display text.
 *
 * Usage:
 *   this.notifications.success(this.t.instant('order.saved'));
 *   this.notifications.error(err?.error?.message ?? this.t.instant('common.error'));
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly _notifications = new BehaviorSubject<AppNotification[]>([]);
  readonly notifications$: Observable<AppNotification[]> = this._notifications.asObservable();
  private nextId = 1;

  success(message: string, duration = 4000): void {
    this.push('success', message, duration);
  }

  error(message: string, duration = 7000): void {
    this.push('error', message, duration);
  }

  info(message: string, duration = 4000): void {
    this.push('info', message, duration);
  }

  warning(message: string, duration = 5000): void {
    this.push('warning', message, duration);
  }

  dismiss(id: number): void {
    this._notifications.next(this._notifications.value.filter(n => n.id !== id));
  }

  clear(): void {
    this._notifications.next([]);
  }

  private push(type: NotificationType, message: string, duration: number): void {
    if (!message) {
      return;
    }
    const notification: AppNotification = { id: this.nextId++, type, message, duration };
    this._notifications.next([...this._notifications.value, notification]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(notification.id), duration);
    }
  }
}
