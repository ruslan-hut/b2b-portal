import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CrmService } from '../../services/crm.service';
import { CrmWorkloadStats, CrmDashboardFilters } from '../../models/crm-dashboard.model';
import { PageTitleService } from '../../../../core/services/page-title.service';

@Component({
    selector: 'app-workload',
    templateUrl: './workload.component.html',
    styleUrls: ['./workload.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkloadComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  workloadStats: CrmWorkloadStats[] = [];
  loading = false;
  error: string | null = null;
  isFiltersExpanded = false;

  // Filters
  currentFilters: CrmDashboardFilters = {};

  // Sort options
  sortBy: 'name' | 'orders' | 'tasks' | 'overdue' = 'orders';
  sortAsc = false;

  constructor(
    private crmService: CrmService,
    public router: Router,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('CRM Workload');
    this.loadWorkload();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadWorkload(): void {
    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.crmService.getWorkload(this.currentFilters).subscribe({
        next: (stats) => {
          this.workloadStats = stats;
          this.sortWorkload();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load workload:', err);
          this.error = 'Failed to load workload data';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  onFiltersChange(filters: CrmDashboardFilters): void {
    this.currentFilters = filters;
    this.loadWorkload();
  }

  sortWorkload(): void {
    this.workloadStats.sort((a, b) => {
      let comparison = 0;
      switch (this.sortBy) {
        case 'name':
          comparison = (a.user_name || '').localeCompare(b.user_name || '');
          break;
        case 'orders':
          comparison = a.assigned_orders - b.assigned_orders;
          break;
        case 'tasks':
          comparison = a.pending_tasks - b.pending_tasks;
          break;
        case 'overdue':
          comparison = a.overdue_tasks - b.overdue_tasks;
          break;
      }
      return this.sortAsc ? comparison : -comparison;
    });
  }

  toggleSort(column: 'name' | 'orders' | 'tasks' | 'overdue'): void {
    if (this.sortBy === column) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortBy = column;
      this.sortAsc = column === 'name';
    }
    this.sortWorkload();
    this.cdr.detectChanges();
  }

  getSortIcon(column: string): string {
    if (this.sortBy !== column) return '';
    return this.sortAsc ? '&#9650;' : '&#9660;';
  }

  toggleFilters(): void {
    this.isFiltersExpanded = !this.isFiltersExpanded;
    this.cdr.detectChanges();
  }

  // Stats calculations
  get totalOrders(): number {
    return this.workloadStats.reduce((sum, w) => sum + w.assigned_orders, 0);
  }

  get totalPendingTasks(): number {
    return this.workloadStats.reduce((sum, w) => sum + w.pending_tasks, 0);
  }

  get totalOverdueTasks(): number {
    return this.workloadStats.reduce((sum, w) => sum + w.overdue_tasks, 0);
  }

  get totalCompletedToday(): number {
    return this.workloadStats.reduce((sum, w) => sum + w.completed_today, 0);
  }

  // Chart helpers
  getMaxValue(): number {
    if (this.workloadStats.length === 0) return 1;
    return Math.max(
      ...this.workloadStats.map(w => Math.max(w.assigned_orders, w.pending_tasks)),
      1
    );
  }

  getBarWidth(value: number): number {
    return (value / this.getMaxValue()) * 100;
  }

  getWorkloadLevel(stats: CrmWorkloadStats): 'low' | 'medium' | 'high' {
    const total = stats.assigned_orders + stats.pending_tasks;
    if (total <= 5) return 'low';
    if (total <= 15) return 'medium';
    return 'high';
  }

  getWorkloadColor(stats: CrmWorkloadStats): string {
    const level = this.getWorkloadLevel(stats);
    switch (level) {
      case 'low': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
    }
  }
}
