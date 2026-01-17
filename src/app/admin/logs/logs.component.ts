import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { LogService, LogEntry, LogFilters } from '../../core/services/log.service';

@Component({
    selector: 'app-logs',
    templateUrl: './logs.component.html',
    styleUrls: ['./logs.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LogsComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  logs: LogEntry[] = [];
  loading = false;
  error: string | null = null;
  
  // Pagination
  currentPage = 1;
  pageSize = 50;
  total = 0;
  totalPages = 1;
  
  // Filters
  filters: LogFilters = {};
  levelFilter = '';
  userUidFilter = '';
  requestIdFilter = '';
  dateFromFilter = '';
  dateToFilter = '';
  searchFilter = '';

  // Expanded rows
  expandedRows = new Set<number>();

  // Mobile UI state
  isFiltersExpanded = false;

  constructor(
    private logService: LogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadLogs(): void {
    this.loading = true;
    this.error = null;

    // Build filters
    const filters: LogFilters = {};
    if (this.levelFilter) {
      filters.level = this.levelFilter;
    }
    if (this.userUidFilter) {
      filters.user_uid = this.userUidFilter;
    }
    if (this.requestIdFilter) {
      filters.request_id = this.requestIdFilter;
    }
    if (this.dateFromFilter) {
      filters.date_from = new Date(this.dateFromFilter).toISOString();
    }
    if (this.dateToFilter) {
      const dateTo = new Date(this.dateToFilter);
      dateTo.setHours(23, 59, 59, 999); // End of day
      filters.date_to = dateTo.toISOString();
    }
    if (this.searchFilter) {
      filters.search = this.searchFilter;
    }

    this.subscriptions.add(
      this.logService.listLogs(this.currentPage, this.pageSize, filters).subscribe({
        next: (response) => {
          this.logs = response.data || [];
          this.total = response.metadata?.total || this.logs.length;
          this.totalPages = response.metadata?.total_pages || Math.ceil(this.total / this.pageSize);
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load logs:', err);
          this.error = 'Failed to load logs';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadLogs();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.loadLogs();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadLogs();
    }
  }

  toggleRow(id: number): void {
    if (this.expandedRows.has(id)) {
      this.expandedRows.delete(id);
    } else {
      this.expandedRows.add(id);
    }
  }

  isRowExpanded(id: number): boolean {
    return this.expandedRows.has(id);
  }

  getLevelClass(level: string): string {
    const levelLower = level.toLowerCase();
    switch (levelLower) {
      case 'error':
        return 'level-error';
      case 'warn':
        return 'level-warn';
      case 'info':
        return 'level-info';
      case 'debug':
        return 'level-debug';
      default:
        return 'level-default';
    }
  }

  formatExtra(extra?: string): any {
    if (!extra) {
      return null;
    }
    try {
      return JSON.parse(extra);
    } catch {
      return extra;
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  refresh(): void {
    this.loadLogs();
  }

  cleanupLogs(): void {
    if (!confirm('Are you sure you want to cleanup old logs? This action cannot be undone.')) {
      return;
    }

    this.subscriptions.add(
      this.logService.cleanupLogs(90).subscribe({
        next: (response) => {
          alert(`Cleanup completed. Deleted ${response.data?.deleted_count || 0} log entries.`);
          this.loadLogs();
        },
        error: (err) => {
          console.error('Failed to cleanup logs:', err);
          alert('Failed to cleanup logs');
        }
      })
    );
  }

  // Mobile UI methods
  toggleFilters(): void {
    this.isFiltersExpanded = !this.isFiltersExpanded;
  }
}

