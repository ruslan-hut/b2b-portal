import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

// Subscription type bitflags
const SUB_TYPE_LOGS = 1;           // 0b00001 - Log notifications
const SUB_TYPE_NEW_ORDERS = 2;     // 0b00010 - New order notifications
const SUB_TYPE_STAGE_CHANGES = 4;  // 0b00100 - Stage change notifications
const SUB_TYPE_ORDER_EDITS = 8;    // 0b01000 - Order edit notifications
const SUB_TYPE_ALL_ORDERS = 16;    // 0b10000 - All orders flag (vs only assigned orders)

interface TelegramSubscription {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  log_level: string;
  active: boolean;
  subscription_types: number;
  internal_user_uid: string | null;
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

interface InternalUser {
  uid: string;
  username: string;
  first_name: string;
  last_name: string;
  user_role: string;
}

interface ApiResponse<T> {
  data: T;
  status: string;
  message?: string;
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
  isFiltersExpanded = false;

  // Log level options
  logLevels = ['debug', 'info', 'warning', 'error'];

  // Expanded items for mobile view
  expandedItems = new Set<number>();

  // Users list for assignment
  users: InternalUser[] = [];

  // Edit modal state
  editingSubscription: TelegramSubscription | null = null;
  editSubscriptionTypes: {
    logs: boolean;
    new_orders: boolean;
    stage_changes: boolean;
    order_edits: boolean;
    all_orders: boolean;
  } = {
    logs: true,
    new_orders: false,
    stage_changes: false,
    order_edits: false,
    all_orders: false
  };
  editInternalUserUid: string | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSubscriptions();
    this.loadUsers();
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

  toggleFilters(): void {
    this.isFiltersExpanded = !this.isFiltersExpanded;
    this.cdr.detectChanges();
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

  loadUsers(): void {
    const url = `${this.apiUrl}/admin/user?offset=0&limit=1000`;
    this.subscriptions.add(
      this.http.get<ApiResponse<InternalUser[]>>(url).subscribe({
        next: (response) => {
          this.users = response.data || [];
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load users:', err);
        }
      })
    );
  }

  // Subscription types helper methods
  hasSubscriptionType(sub: TelegramSubscription, type: number): boolean {
    return (sub.subscription_types & type) !== 0;
  }

  getSubscriptionTypesLabel(sub: TelegramSubscription): string {
    const types: string[] = [];
    if (this.hasSubscriptionType(sub, SUB_TYPE_LOGS)) types.push('Logs');
    if (this.hasSubscriptionType(sub, SUB_TYPE_NEW_ORDERS)) types.push('New Orders');
    if (this.hasSubscriptionType(sub, SUB_TYPE_STAGE_CHANGES)) types.push('Stage Changes');
    if (this.hasSubscriptionType(sub, SUB_TYPE_ORDER_EDITS)) types.push('Order Edits');
    return types.length > 0 ? types.join(', ') : 'None';
  }

  getAssignmentLabel(sub: TelegramSubscription): string {
    if (this.hasSubscriptionType(sub, SUB_TYPE_ALL_ORDERS)) {
      return 'All Orders';
    } else if (sub.internal_user_uid) {
      const user = this.users.find(u => u.uid === sub.internal_user_uid);
      if (user) {
        return `Assigned: ${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
      }
      return 'Assigned (Unknown User)';
    }
    return 'All Orders (Legacy)';
  }

  // Edit subscription types modal
  openEditModal(item: TelegramSubscription): void {
    this.editingSubscription = item;
    this.editSubscriptionTypes = {
      logs: this.hasSubscriptionType(item, SUB_TYPE_LOGS),
      new_orders: this.hasSubscriptionType(item, SUB_TYPE_NEW_ORDERS),
      stage_changes: this.hasSubscriptionType(item, SUB_TYPE_STAGE_CHANGES),
      order_edits: this.hasSubscriptionType(item, SUB_TYPE_ORDER_EDITS),
      all_orders: this.hasSubscriptionType(item, SUB_TYPE_ALL_ORDERS)
    };
    this.editInternalUserUid = item.internal_user_uid;
    this.cdr.detectChanges();
  }

  closeEditModal(): void {
    this.editingSubscription = null;
    this.cdr.detectChanges();
  }

  saveSubscriptionTypes(): void {
    if (!this.editingSubscription) return;

    // Calculate subscription types bitflags
    let subscriptionTypes = 0;
    if (this.editSubscriptionTypes.logs) subscriptionTypes |= SUB_TYPE_LOGS;
    if (this.editSubscriptionTypes.new_orders) subscriptionTypes |= SUB_TYPE_NEW_ORDERS;
    if (this.editSubscriptionTypes.stage_changes) subscriptionTypes |= SUB_TYPE_STAGE_CHANGES;
    if (this.editSubscriptionTypes.order_edits) subscriptionTypes |= SUB_TYPE_ORDER_EDITS;
    if (this.editSubscriptionTypes.all_orders) subscriptionTypes |= SUB_TYPE_ALL_ORDERS;

    const updateData: any = {
      user_id: this.editingSubscription.user_id,
      subscription_types: subscriptionTypes
    };

    // Only include internal_user_uid if not "all_orders"
    if (!this.editSubscriptionTypes.all_orders) {
      updateData.internal_user_uid = this.editInternalUserUid || null;
    } else {
      // Clear user assignment when "all_orders" is enabled
      updateData.internal_user_uid = null;
    }

    this.subscriptions.add(
      this.http.put(`${this.apiUrl}/admin/telegram/subscriptions/types`, {
        data: updateData
      }).subscribe({
        next: () => {
          // Update local item
          this.editingSubscription!.subscription_types = subscriptionTypes;
          this.editingSubscription!.internal_user_uid = updateData.internal_user_uid;
          this.closeEditModal();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to update subscription types:', err);
          this.error = 'Failed to update subscription types';
          this.cdr.detectChanges();
        }
      })
    );
  }

  getUserDisplayName(userUid: string | null): string {
    if (!userUid) return 'None';
    const user = this.users.find(u => u.uid === userUid);
    if (!user) return 'Unknown User';
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  }

  refresh(): void {
    this.loadSubscriptions();
  }
}
