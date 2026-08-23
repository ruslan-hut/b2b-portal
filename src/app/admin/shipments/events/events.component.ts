import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { formatDateTime } from '../../../core/utils/date-format';
import { ToggleState, ExpandState } from '../../../core/utils/ui-state';

interface ShipmentEventRow {
  uid: string;
  shipment_uid: string;
  order_uid: string;
  order_number?: string;
  carrier_uid: string;
  carrier_name?: string;
  tracking_number?: string;
  event_code: string;
  event_status: string;
  event_description?: string;
  terminal_name?: string;
  terminal_city?: string;
  event_timestamp: string;
  received_at: string;
}

interface CarrierOption {
  uid: string;
  name: string;
}

@Component({
  selector: 'app-shipment-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventsComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private activeLoad?: Subscription;
  private readonly apiUrl = environment.apiUrl;

  events: ShipmentEventRow[] = [];
  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 50;
  total = 0;
  totalPages = 1;

  // Filters (server-side)
  driverFilter = '';
  statusFilter = '';
  searchFilter = '';
  dateFromFilter = '';
  dateToFilter = '';

  filters = new ToggleState();
  rows = new ExpandState();

  driverOptions: CarrierOption[] = [];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadCarriers();
    this.loadEvents();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadCarriers(): void {
    this.subscriptions.add(
      this.http.get<ApiResponse<CarrierOption[]>>(`${this.apiUrl}/admin/shipment/carriers`).subscribe({
        next: (response) => {
          this.driverOptions = (response.data || [])
            .map(c => ({ uid: c.uid, name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
          this.cdr.detectChanges();
        },
        error: () => {
          // Non-fatal: the driver filter just stays empty.
        }
      })
    );
  }

  loadEvents(): void {
    this.loading = true;
    this.error = null;

    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('count', this.pageSize.toString());

    if (this.driverFilter) {
      params = params.set('carrier_uid', this.driverFilter);
    }
    if (this.statusFilter) {
      params = params.set('status', this.statusFilter.trim());
    }
    if (this.searchFilter) {
      params = params.set('search', this.searchFilter.trim());
    }
    if (this.dateFromFilter) {
      params = params.set('date_from', new Date(this.dateFromFilter).toISOString());
    }
    if (this.dateToFilter) {
      const dateTo = new Date(this.dateToFilter);
      dateTo.setHours(23, 59, 59, 999);
      params = params.set('date_to', dateTo.toISOString());
    }

    // Cancel any in-flight load so a slow response can't overwrite a newer one.
    this.activeLoad?.unsubscribe();
    this.activeLoad = this.http.get<ApiResponse<ShipmentEventRow[]>>(`${this.apiUrl}/admin/orders/shipment/events`, { params }).subscribe({
      next: (response) => {
        this.events = response.data || [];
        this.total = response.metadata?.total ?? this.events.length;
        this.totalPages = response.metadata?.total_pages ?? Math.max(1, Math.ceil(this.total / this.pageSize));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load shipment events:', err);
        this.error = 'Failed to load shipment events';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
    this.subscriptions.add(this.activeLoad);
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadEvents();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadEvents();
    }
  }

  getDriverName(event: ShipmentEventRow): string {
    return event.carrier_name || event.carrier_uid;
  }

  getStatusClass(status: string): string {
    return `status-${(status || '').toLowerCase()}`;
  }

  formatDate(value?: string): string {
    return value ? formatDateTime(value) : '—';
  }
}
