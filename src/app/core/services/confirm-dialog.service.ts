import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface ConfirmOptions {
  /** Dialog title (already-translated display text). */
  title?: string;
  /** Body message (already-translated display text). */
  message: string;
  /** Confirm button label (already-translated). Defaults to a generic "OK". */
  confirmLabel?: string;
  /** Cancel button label (already-translated). Defaults to a generic "Cancel". */
  cancelLabel?: string;
  /** Style the confirm action as destructive (red). */
  danger?: boolean;
}

interface ActiveConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * Promise-based confirmation dialog, a styled/translatable/accessible
 * replacement for the native blocking confirm(). A single host component
 * (ConfirmDialogComponent) renders whatever this service exposes.
 *
 * Usage:
 *   if (await this.confirm.ask({ message: this.t.instant('orders.deleteConfirm'), danger: true })) {
 *     ...
 *   }
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly _active = new BehaviorSubject<ActiveConfirm | null>(null);
  readonly active$: Observable<ActiveConfirm | null> = this._active.asObservable();

  /** Opens the dialog and resolves true (confirmed) or false (cancelled/dismissed). */
  ask(options: ConfirmOptions): Promise<boolean> {
    // If a dialog is already open, resolve it as cancelled before replacing it.
    const current = this._active.value;
    if (current) {
      current.resolve(false);
    }

    return new Promise<boolean>(resolve => {
      this._active.next({
        ...options,
        resolve: (confirmed: boolean) => {
          this._active.next(null);
          resolve(confirmed);
        }
      });
    });
  }

  /** Called by the host component when the user confirms. */
  confirm(): void {
    this._active.value?.resolve(true);
  }

  /** Called by the host component when the user cancels or dismisses. */
  cancel(): void {
    this._active.value?.resolve(false);
  }
}
