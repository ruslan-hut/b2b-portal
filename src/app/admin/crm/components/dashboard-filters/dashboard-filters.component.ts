import { Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Store } from '../../../../core/models/store.model';
import { StoreService } from '../../../../core/services/store.service';
import { CrmService, CrmAssignableUser } from '../../services/crm.service';
import { CrmDashboardFilters } from '../../models/crm-dashboard.model';

@Component({
    selector: 'app-dashboard-filters',
    templateUrl: './dashboard-filters.component.html',
    styleUrls: ['./dashboard-filters.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardFiltersComponent implements OnInit, OnDestroy {
  @Output() filtersChange = new EventEmitter<CrmDashboardFilters>();

  private subscriptions = new Subscription();

  // Filter values
  selectedStoreUid: string = '';
  selectedAssigneeUid: string = '';
  dateFrom: string = '';
  dateTo: string = '';

  // Options
  stores: Store[] = [];
  assignableUsers: CrmAssignableUser[] = [];

  // UI state
  loading = false;

  constructor(
    private storeService: StoreService,
    private crmService: CrmService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFilterOptions();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadFilterOptions(): void {
    this.loading = true;

    // Load stores
    this.subscriptions.add(
      this.storeService.getStores().subscribe({
        next: (storesMap) => {
          this.stores = Object.values(storesMap).filter(s => s.active !== false);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load stores:', err);
        }
      })
    );

    // Load assignable users
    this.subscriptions.add(
      this.crmService.getAssignableUsers().subscribe({
        next: (users) => {
          this.assignableUsers = users;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load assignable users:', err);
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  onFilterChange(): void {
    const filters: CrmDashboardFilters = {};

    if (this.selectedStoreUid) {
      filters.storeUid = this.selectedStoreUid;
    }

    if (this.selectedAssigneeUid) {
      filters.assigneeUid = this.selectedAssigneeUid;
    }

    if (this.dateFrom) {
      // Convert date to RFC3339 format
      filters.dateFrom = new Date(this.dateFrom + 'T00:00:00').toISOString();
    }

    if (this.dateTo) {
      // Convert date to RFC3339 format, end of day
      filters.dateTo = new Date(this.dateTo + 'T23:59:59').toISOString();
    }

    this.filtersChange.emit(filters);
  }

  clearFilters(): void {
    this.selectedStoreUid = '';
    this.selectedAssigneeUid = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.filtersChange.emit({});
  }

  get hasActiveFilters(): boolean {
    return !!(this.selectedStoreUid || this.selectedAssigneeUid || this.dateFrom || this.dateTo);
  }

  getUserDisplayName(user: CrmAssignableUser): string {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.username || user.email;
  }
}
