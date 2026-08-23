import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { formatDateTime } from '../../../core/utils/date-format';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslationService } from '../../../core/services/translation.service';

// One courier collection. The backend derives these from the shipments that
// share a dispatch order id, so the counts always match what is on the parcels.
interface PickupRow {
  dispatch_order_id: string;
  carrier_uid: string;
  carrier_name?: string;
  carrier_type?: string;
  shipment_count: number;
  booked_at: string;
  delivered: number;
}

interface CarrierOption {
  uid: string;
  name: string;
  carrier_type: string;
  active: boolean;
}

// Carriers whose driver can book a courier on demand. Others either collect on a
// standing arrangement or book automatically with each shipment, and the backend
// answers "nothing booked" for them.
const PICKUP_CAPABLE_TYPES = ['dhl_express', 'inpost', 'gls'];

@Component({
  selector: 'app-shipment-pickups',
  templateUrl: './pickups.component.html',
  styleUrls: ['./pickups.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PickupsComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notifications = inject(NotificationService);
  private readonly translation = inject(TranslationService);

  private subscriptions = new Subscription();
  private readonly apiUrl = environment.apiUrl;

  pickups: PickupRow[] = [];
  carriers: CarrierOption[] = [];
  loading = false;
  booking = false;
  error: string | null = null;

  selectedCarrier = '';
  // The collection window. Empty date/time means "as soon as the carrier can",
  // which is what the background booking does; the close time defaults to the
  // carrier's own configured one.
  pickupDate = '';
  readyTime = '';
  closeTime = '';
  instructions = '';

  ngOnInit(): void {
    this.loadCarriers();
    this.loadPickups();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadPickups(): void {
    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.http.get<ApiResponse<PickupRow[]>>(`${this.apiUrl}/admin/orders/shipment/pickups`).subscribe({
        next: response => {
          this.pickups = response.data || [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: err => {
          console.error('Failed to load pickups:', err);
          this.error = this.translation.instant('admin.shipments.pickupsLoadError');
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  private loadCarriers(): void {
    this.subscriptions.add(
      this.http.get<ApiResponse<CarrierOption[]>>(`${this.apiUrl}/admin/shipment/carriers`).subscribe({
        next: response => {
          this.carriers = (response.data || [])
            .filter(c => c.active && PICKUP_CAPABLE_TYPES.includes(c.carrier_type))
            .sort((a, b) => a.name.localeCompare(b.name));
          if (this.carriers.length === 1) {
            this.selectedCarrier = this.carriers[0].uid;
          }
          this.cdr.detectChanges();
        },
        error: () => {
          // Non-fatal: the list still renders, only the booking control is empty.
        }
      })
    );
  }

  async bookPickup(): Promise<void> {
    if (!this.selectedCarrier || this.booking) {
      return;
    }

    // Booking sends a real van to the warehouse and, on most contracts, costs
    // money. It is not something to do on a single stray click.
    const carrier = this.carriers.find(c => c.uid === this.selectedCarrier);
    const confirmed = await this.confirmDialog.ask({
      title: this.translation.instant('admin.shipments.callCourierTitle'),
      message: this.translation.instant('admin.shipments.callCourierConfirm', {
        carrier: carrier?.name || '',
        when: this.windowSummary()
      })
    });
    if (!confirmed) {
      return;
    }

    this.booking = true;
    this.subscriptions.add(
      this.http.post<ApiResponse<{ dispatch_order_id: string; included_shipment_uids?: string[] } | null>>(
        `${this.apiUrl}/admin/orders/shipment/pickups/book`,
        {
          data: {
            carrier_uid: this.selectedCarrier,
            date: this.pickupDate || undefined,
            ready_time: this.readyTime || undefined,
            close_time: this.closeTime || undefined,
            instructions: this.instructions.trim() || undefined
          }
        }
      ).subscribe({
        next: response => {
          this.booking = false;
          if (!response.data) {
            // Nothing was waiting, or the carrier books its own courier per
            // shipment. Not a failure, but the operator must not be left
            // thinking a courier is on the way.
            this.notifications.info(this.translation.instant('admin.shipments.pickupNothingBooked'));
          } else {
            this.notifications.success(this.translation.instant('admin.shipments.pickupBookedCount', {
              count: response.data.included_shipment_uids?.length ?? 0
            }));
          }
          this.loadPickups();
        },
        error: err => {
          console.error('Failed to book pickup:', err);
          this.booking = false;
          this.notifications.error(
            err.error?.message || this.translation.instant('admin.shipments.pickupBookError')
          );
          this.cdr.detectChanges();
        }
      })
    );
  }

  async cancelPickup(pickup: PickupRow): Promise<void> {
    const confirmed = await this.confirmDialog.ask({
      title: this.translation.instant('admin.shipments.pickupCancelTitle'),
      message: this.translation.instant('admin.shipments.pickupCancelConfirm', {
        id: pickup.dispatch_order_id,
        count: pickup.shipment_count
      }),
      confirmLabel: this.translation.instant('admin.shipments.pickupCancelAction'),
      danger: true
    });
    if (!confirmed) {
      return;
    }

    this.subscriptions.add(
      this.http.post<ApiResponse<null>>(`${this.apiUrl}/admin/orders/shipment/pickups/cancel`, {
        data: {
          carrier_uid: pickup.carrier_uid,
          dispatch_order_id: pickup.dispatch_order_id
        }
      }).subscribe({
        next: () => {
          this.notifications.success(this.translation.instant('admin.shipments.pickupCancelled'));
          this.loadPickups();
        },
        error: err => {
          console.error('Failed to cancel pickup:', err);
          this.notifications.error(
            err.error?.message || this.translation.instant('admin.shipments.pickupCancelError')
          );
        }
      })
    );
  }

  // Reads back the chosen window the way the confirmation should describe it,
  // so nobody confirms a collection without knowing when it is for.
  windowSummary(): string {
    const day = this.pickupDate
      ? this.pickupDate
      : this.translation.instant('admin.shipments.pickupToday');

    if (this.readyTime && this.closeTime) {
      return `${day}, ${this.readyTime}–${this.closeTime}`;
    }
    if (this.readyTime) {
      return `${day}, ${this.translation.instant('admin.shipments.pickupFrom')} ${this.readyTime}`;
    }
    if (this.closeTime) {
      return `${day}, ${this.translation.instant('admin.shipments.pickupUntil')} ${this.closeTime}`;
    }
    return `${day}, ${this.translation.instant('admin.shipments.pickupAsap')}`;
  }

  carrierName(pickup: PickupRow): string {
    return pickup.carrier_name || pickup.carrier_uid;
  }

  // A collection whose parcels have all been delivered is history; one with
  // parcels still out is the courier's current run.
  isComplete(pickup: PickupRow): boolean {
    return pickup.shipment_count > 0 && pickup.delivered >= pickup.shipment_count;
  }

  formatDate(value?: string): string {
    return value ? formatDateTime(value) : '—';
  }
}
