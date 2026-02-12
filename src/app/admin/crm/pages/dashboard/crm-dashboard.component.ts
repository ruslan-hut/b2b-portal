import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CrmService } from '../../services/crm.service';
import { CrmDashboardStats, CrmPipelineStageStats, CrmWorkloadStats, CrmTaskStats, CrmDashboardFilters } from '../../models/crm-dashboard.model';
import { CrmActivity } from '../../models/crm-activity.model';
import { PageTitleService } from '../../../../core/services/page-title.service';

@Component({
    selector: 'app-crm-dashboard',
    templateUrl: './crm-dashboard.component.html',
    styleUrls: ['./crm-dashboard.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CrmDashboardComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  // Dashboard data
  pipelineStats: CrmPipelineStageStats[] = [];
  workloadStats: CrmWorkloadStats[] = [];
  taskStats: CrmTaskStats = {
    total_pending: 0,
    total_in_progress: 0,
    total_overdue: 0,
    completed_today: 0,
    completed_week: 0
  };
  recentActivity: CrmActivity[] = [];

  // UI state
  loading = false;
  error: string | null = null;
  isFiltersExpanded = false;

  // Filters
  currentFilters: CrmDashboardFilters = {};

  constructor(
    private crmService: CrmService,
    public router: Router,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('CRM Dashboard');
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.crmService.getDashboard(this.currentFilters).subscribe({
        next: (stats: CrmDashboardStats) => {
          this.pipelineStats = stats.pipeline_stats || [];
          this.workloadStats = stats.workload_stats || [];
          this.taskStats = stats.task_stats || {
            total_pending: 0,
            total_in_progress: 0,
            total_overdue: 0,
            completed_today: 0,
            completed_week: 0
          };
          this.recentActivity = stats.recent_activity || [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load dashboard:', err);
          this.error = 'Failed to load dashboard data';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  onFiltersChange(filters: CrmDashboardFilters): void {
    this.currentFilters = filters;
    this.loadDashboard();
  }

  toggleFilters(): void {
    this.isFiltersExpanded = !this.isFiltersExpanded;
    this.cdr.detectChanges();
  }

  // Computed values
  get totalOrdersInPipeline(): number {
    return this.pipelineStats.reduce((sum, s) => sum + s.order_count, 0);
  }

  get totalPipelineValue(): number {
    return this.pipelineStats.reduce((sum, s) => sum + s.total_value, 0);
  }

  get totalActiveTasks(): number {
    return this.taskStats.total_pending + this.taskStats.total_in_progress;
  }

  get totalTeamMembers(): number {
    return this.workloadStats.length;
  }

  // Formatting
  formatCurrency(value: number): string {
    return (value / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatNumber(value: number): string {
    return value.toLocaleString();
  }

  formatAvgDays(days: number): string {
    if (days < 1) {
      return '< 1 day';
    }
    return `${Math.round(days)} day${Math.round(days) !== 1 ? 's' : ''}`;
  }

  formatActivityDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }

  getActivityIcon(activityType: string): string {
    switch (activityType) {
      case 'stage_change': return '&#8644;';
      case 'assignment': return '&#128100;';
      case 'unassignment': return '&#128101;';
      case 'note': return '&#128221;';
      case 'task_created': return '&#9998;';
      case 'task_completed': return '&#10003;';
      case 'order_created': return '&#128230;';
      default: return '&#9679;';
    }
  }

  // Pipeline chart helpers
  getMaxOrderCount(): number {
    if (this.pipelineStats.length === 0) return 1;
    return Math.max(...this.pipelineStats.map(s => s.order_count), 1);
  }

  getBarWidth(orderCount: number): number {
    const max = this.getMaxOrderCount();
    return (orderCount / max) * 100;
  }

  // Workload helpers
  getMaxWorkload(): number {
    if (this.workloadStats.length === 0) return 1;
    return Math.max(...this.workloadStats.map(w => w.assigned_orders + w.pending_tasks), 1);
  }

  getWorkloadBarWidth(stats: CrmWorkloadStats): number {
    const max = this.getMaxWorkload();
    return ((stats.assigned_orders + stats.pending_tasks) / max) * 100;
  }
}
