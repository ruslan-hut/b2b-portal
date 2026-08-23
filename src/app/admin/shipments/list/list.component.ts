import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { formatDateTime } from '../../../core/utils/date-format';
import { ToggleState } from '../../../core/utils/ui-state';

/** One order a shipment covers. Present only on consolidated shipments. */
interface ShipmentOrderRef {
  order_uid: string;
  number?: string;
  lead?: boolean;
}

interface ShipmentRow {
  uid: string;
  order_uid: string;
  order_number?: string;
  /**
   * Every order on this waybill, lead first. Empty unless consolidated, so the
   * row falls back to the single order_uid link exactly as before.
   */
  orders?: ShipmentOrderRef[];
  carrier_uid: string;
  carrier_name?: string;
  tracking_number?: string;
  status: string;
  status_description?: string;
  receiver_name: string;
  receiver_city: string;
  has_label: boolean;
  shipped_at?: string;
  delivered_at?: string;
  created_at: string;
}

interface CarrierOption {
  uid: string;
  name: string;
}

@Component({
  selector: 'app-shipments-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private activeLoad?: Subscription;
  private readonly apiUrl = environment.apiUrl;

  shipments: ShipmentRow[] = [];
  filtered: ShipmentRow[] = [];
  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 50;
  total = 0;
  totalPages = 1;

  // Status and driver filters are applied client-side over the loaded page;
  // search is sent to the server so it spans all pages.
  statusFilter = '';
  driverFilter = '';
  searchTerm = '';
  private searchChange = new Subject<string>();

  filters = new ToggleState();

  // carrier_uid -> name
  private carriers: { [uid: string]: string } = {};
  driverOptions: CarrierOption[] = [];

  statusOptions = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'created', label: 'Created' },
    { value: 'picked_up', label: 'Picked up' },
    { value: 'in_transit', label: 'In transit' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'returned', label: 'Returned' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'error', label: 'Error' }
  ];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.searchChange.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
        this.currentPage = 1;
        this.loadShipments();
      })
    );
    this.loadCarriers();
    this.loadShipments();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadCarriers(): void {
    this.subscriptions.add(
      this.http.get<ApiResponse<CarrierOption[]>>(`${this.apiUrl}/admin/shipment/carriers`).subscribe({
        next: (response) => {
          const list = response.data || [];
          list.forEach(c => (this.carriers[c.uid] = c.name));
          this.driverOptions = list
            .map(c => ({ uid: c.uid, name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
          this.cdr.detectChanges();
        },
        error: () => {
          // Non-fatal: driver names fall back to carrier UID.
        }
      })
    );
  }

  loadShipments(): void {
    // Cancel any in-flight load so a slow response can't overwrite a newer one.
    this.activeLoad?.unsubscribe();
    this.loading = true;
    this.error = null;

    let params = new HttpParams()
      .set('offset', ((this.currentPage - 1) * this.pageSize).toString())
      .set('limit', this.pageSize.toString());

    const search = this.searchTerm.trim();
    if (search) {
      params = params.set('search', search);
    }

    this.activeLoad = this.http.get<ApiResponse<ShipmentRow[]>>(`${this.apiUrl}/admin/orders/shipment/`, { params }).subscribe({
      next: (response) => {
        this.shipments = response.data || [];
        this.total = response.metadata?.total ?? this.shipments.length;
        this.totalPages = Math.max(1, Math.ceil(this.total / this.pageSize));
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load shipments:', err);
        this.error = 'Failed to load shipments';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
    this.subscriptions.add(this.activeLoad);
  }

  applyFilters(): void {
    this.filtered = this.shipments.filter(s => {
      if (this.statusFilter && s.status !== this.statusFilter) {
        return false;
      }
      if (this.driverFilter && s.carrier_uid !== this.driverFilter) {
        return false;
      }
      return true;
    });
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  onSearchChange(): void {
    this.searchChange.next(this.searchTerm);
  }

  getDriverName(carrierUid: string): string {
    return this.carriers[carrierUid] || carrierUid;
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  formatDate(value?: string): string {
    return value ? formatDateTime(value) : '—';
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadShipments();
    }
  }
}
