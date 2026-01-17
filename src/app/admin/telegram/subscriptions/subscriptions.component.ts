import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface TelegramSubscription {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  log_level: string;
  active: boolean;
  created_at: string;
}

interface SubscriptionsResponse {
  data: TelegramSubscription[];
  pagination: {
    page: number;
    count: number;
    total: number;
    total_pages: number;
  };
}

@Component({
  selector: 'app-subscriptions',
  templateUrl: './subscriptions.component.html',
  styleUrls: ['./subscriptions.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionsComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private apiUrl = environment.apiUrl;

  items: TelegramSubscription[] = [];
  filteredItems: TelegramSubscription[] = [];

  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;

  // Filters
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  searchQuery = '';

  // Log level options
  logLevels = ['debug', 'info', 'warning', 'error'];

  // Expanded items for mobile view
  expandedItems = new Set<number>();

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSubscriptions();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadSubscriptions(): void {
    this.loading = true;
    this.error = null;

    const url = `${this.apiUrl}/admin/telegram/subscriptions?page=${this.currentPage}&count=${this.pageSize}`;

    this.subscriptions.add(
      this.http.get<SubscriptionsResponse>(url).subscribe({
        next: (response) => {
          this.items = response.data || [];
          this.total = response.pagination?.total || this.items.length;
          this.totalPages = response.pagination?.total_pages || 1;
          this.applyFilters();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load subscriptions:', err);
          this.error = 'Failed to load subscriptions';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  applyFilters(): void {
    let filtered = [...this.items];

    // Apply status filter
    if (this.statusFilter === 'active') {
      filtered = filtered.filter(item => item.active);
    } else if (this.statusFilter === 'inactive') {
      filtered = filtered.filter(item => !item.active);
    }

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        (item.username && item.username.toLowerCase().includes(query)) ||
        (item.first_name && item.first_name.toLowerCase().includes(query)) ||
        (item.last_name && item.last_name.toLowerCase().includes(query))
      );
    }

    this.filteredItems = filtered;
    this.cdr.detectChanges();
  }

  onStatusFilterChange(): void {
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  toggleActive(item: TelegramSubscription): void {
    const newActive = !item.active;

    this.subscriptions.add(
      this.http.post(`${this.apiUrl}/admin/telegram/subscriptions/update`, {
        data: [{ user_id: item.user_id, active: newActive }]
      }).subscribe({
        next: () => {
          item.active = newActive;
          this.applyFilters();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to update subscription:', err);
          this.error = 'Failed to update subscription';
          this.cdr.detectChanges();
        }
      })
    );
  }

  updateLogLevel(item: TelegramSubscription, newLevel: string): void {
    this.subscriptions.add(
      this.http.post(`${this.apiUrl}/admin/telegram/subscriptions/update`, {
        data: [{ user_id: item.user_id, log_level: newLevel }]
      }).subscribe({
        next: () => {
          item.log_level = newLevel;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to update log level:', err);
          this.error = 'Failed to update log level';
          this.cdr.detectChanges();
        }
      })
    );
  }

  deleteSubscription(item: TelegramSubscription): void {
    const displayName = item.username || `${item.first_name} ${item.last_name}`.trim() || `User ${item.user_id}`;
    if (!confirm(`Are you sure you want to delete subscription for "${displayName}"?`)) {
      return;
    }

    this.subscriptions.add(
      this.http.post(`${this.apiUrl}/admin/telegram/subscriptions/delete`, {
        data: [item.user_id]
      }).subscribe({
        next: () => {
          this.loadSubscriptions();
        },
        error: (err) => {
          console.error('Failed to delete subscription:', err);
          this.error = 'Failed to delete subscription';
          this.cdr.detectChanges();
        }
      })
    );
  }

  toggleExpanded(userId: number): void {
    if (this.expandedItems.has(userId)) {
      this.expandedItems.delete(userId);
    } else {
      this.expandedItems.add(userId);
    }
    this.cdr.detectChanges();
  }

  isExpanded(userId: number): boolean {
    return this.expandedItems.has(userId);
  }

  // Pagination
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadSubscriptions();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Helpers
  getDisplayName(item: TelegramSubscription): string {
    if (item.first_name || item.last_name) {
      return `${item.first_name || ''} ${item.last_name || ''}`.trim();
    }
    return item.username || `User ${item.user_id}`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  refresh(): void {
    this.loadSubscriptions();
  }
}
