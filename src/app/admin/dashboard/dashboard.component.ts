import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { AdminService, DashboardStats } from '../../core/services/admin.service';

interface Store {
  uid: string;
  name?: string;
  [key: string]: any;
}

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    standalone: false
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;
  error: string | null = null;
  stores: Store[] = [];
  selectedStoreUID: string | null = null;
  loadingStores = false;

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStores();
    this.loadDashboardStats();
  }

  loadStores(): void {
    this.loadingStores = true;
    this.adminService.listStores().subscribe({
      next: (stores) => {
        this.stores = stores || [];
        this.loadingStores = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load stores:', err);
        this.loadingStores = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadDashboardStats(): void {
    this.loading = true;
    this.error = null;

    this.adminService.getDashboardStats(this.selectedStoreUID || undefined).subscribe({
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
    });
  }

  onStoreChange(): void {
    this.loadDashboardStats();
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

