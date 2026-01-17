import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AdminService, DashboardStats, DiscountScale } from '../../core/services/admin.service';

interface Store {
  uid: string;
  name?: string;
  [key: string]: any;
}

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  stats: DashboardStats | null = null;
  loading = true;
  error: string | null = null;
  stores: Store[] = [];
  selectedStoreUID: string | null = null;
  loadingStores = false;
  discountScales: DiscountScale[] = [];
  loadingDiscountScales = false;

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStores();
    this.loadDashboardStats();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadStores(): void {
    this.loadingStores = true;
    this.subscriptions.add(
      this.adminService.listStores().subscribe({
        next: (stores) => {
          this.stores = stores || [];
          this.loadingStores = false;
          // Auto-select first store if available and none selected
          if (this.stores.length > 0 && (!this.selectedStoreUID || this.selectedStoreUID === 'null' || this.selectedStoreUID === null)) {
            this.selectedStoreUID = this.stores[0].uid;
            this.loadDashboardStats();
            this.loadDiscountScales();
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load stores:', err);
          this.loadingStores = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  loadDashboardStats(): void {
    this.loading = true;
    this.error = null;

    const storeUID =
        this.selectedStoreUID === undefined ||
        this.selectedStoreUID === 'null' ||
        this.selectedStoreUID === null
            ? undefined : this.selectedStoreUID;

    this.subscriptions.add(
      this.adminService.getDashboardStats(storeUID).subscribe({
        next: (stats) => {
          this.stats = stats;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load dashboard stats:', err);
          this.error = 'Failed to load dashboard statistics';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  onStoreChange(): void {
    this.loadDashboardStats();
    this.loadDiscountScales();
  }

  loadDiscountScales(): void {
    if (!this.selectedStoreUID || this.selectedStoreUID === 'null' || this.selectedStoreUID === null) {
      this.discountScales = [];
      return;
    }

    this.loadingDiscountScales = true;
    this.subscriptions.add(
      this.adminService.getDiscountScales(this.selectedStoreUID).subscribe({
        next: (scales) => {
          this.discountScales = scales || [];
          this.loadingDiscountScales = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load discount scales:', err);
          this.discountScales = [];
          this.loadingDiscountScales = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  formatCurrency(amount: number): string {
    // Convert cents to currency format
    return (amount / 100).toFixed(2);
  }

  formatDiscount(percent: number): string {
    return `${percent}%`;
  }

  getSelectedStoreName(): string {
    if (!this.selectedStoreUID) {
      return '';
    }
    const store = this.stores.find(s => s.uid === this.selectedStoreUID);
    return store?.name || '';
  }

  getOrderStatusCount(status: string): number {
    return this.stats?.orders_by_status[status] || 0;
  }

  getTotalOrders(): number {
    if (!this.stats?.orders_by_status) {
      return 0;
    }
    return Object.values(this.stats.orders_by_status).reduce((sum, count) => sum + count, 0);
  }
}

