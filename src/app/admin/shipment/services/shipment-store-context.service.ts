import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Shared selected-store state for the admin/shipment area.
 *
 * The settings page owns the dropdown and writes the selection here; carriers and boxes
 * pages subscribe so navigation between them preserves the choice. The selection is also
 * mirrored to the URL via ?store=<uid>, which is the source of truth across reloads.
 *
 * Empty string means "all stores".
 */
@Injectable({ providedIn: 'root' })
export class ShipmentStoreContextService {
  private readonly subject = new BehaviorSubject<string>('');
  readonly selectedStore$ = this.subject.asObservable();

  get value(): string {
    return this.subject.value;
  }

  set(uid: string | null | undefined): void {
    const next = uid ?? '';
    if (next !== this.subject.value) {
      this.subject.next(next);
    }
  }

  clear(): void {
    this.set('');
  }
}
