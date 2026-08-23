import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CrmService } from '../../services/crm.service';
import {
  CrmDashboardStats,
  CrmPipelineStageStats,
  CrmWorkloadStats,
  CrmTaskStats,
  CrmDashboardFilters
} from '../../models/crm-dashboard.model';
import { CrmActivity } from '../../models/crm-activity.model';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { formatDate } from '../../../../core/utils/date-format';
import { formatAmount, formatCount } from '../../../../core/utils/money-format';
import { Currency } from '../../../../core/models/currency.model';
import { CrmFiltersEmit } from '../../components/dashboard-filters/dashboard-filters.component';

@Component({
    selector: 'app-crm-dashboard',
    templateUrl: './crm-dashboard.component.html',
    styleUrls: ['./crm-dashboard.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CrmDashboardComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

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

  loading = false;
  error: string | null = null;
  isFiltersExpanded = false;

  currentFilters: CrmDashboardFilters = {};
  selectedCurrency?: Currency;

  constructor(
    private crmService: CrmService,
    public router: Router,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService,
    private translation: TranslationService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('CRM Dashboard');
    // Currency conversion is performed server-side per order (see
    // CRMDashboardRepo.GetPipelineStats). The frontend just sends the
    // selected currency_code in filters and formats the already-converted
    // total_value with that currency's locale.
    this.loadDashboard();

    // Relative times and day counts are translated in the component rather than
    // by the pipe, so nothing re-renders them when the language changes on its
    // own. OnPush means we have to say so.
    this.subscriptions.add(
      this.translation.translations$.subscribe(() => this.cdr.markForCheck())
    );
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
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load dashboard:', err);
          this.error = 'Failed to load dashboard data';
          this.loading = false;
          this.cdr.markForCheck();
        }
      })
    );
  }

  onFiltersChange(event: CrmFiltersEmit): void {
    this.currentFilters = event.filters;
    this.selectedCurrency = event.currency;
    this.loadDashboard();
  }

  toggleFilters(): void {
    this.isFiltersExpanded = !this.isFiltersExpanded;
    this.cdr.markForCheck();
  }

  // Final stages (won/lost/closed) are excluded from the headline totals so the
  // dashboard reflects work currently in flight. Their values still appear in
  // the per-stage chart for visibility.
  get totalOrdersInPipeline(): number {
    return this.pipelineStats.reduce((sum, s) => s.is_final ? sum : sum + s.order_count, 0);
  }

  // Backend has already converted each stage's total_value to the requested
  // currency (per-order conversion to handle mixed PLN/EUR/USD orders), so we
  // can just sum the already-comparable numbers here.
  get totalPipelineValue(): number {
    return this.pipelineStats.reduce((sum, s) => s.is_final ? sum : sum + s.total_value, 0);
  }

  get totalActiveTasks(): number {
    return this.taskStats.total_pending + this.taskStats.total_in_progress;
  }

  get totalTeamMembers(): number {
    return this.workloadStats.length;
  }

  /** The currency every amount on the page is already expressed in. Stated once
   *  per block instead of suffixed to each of ~15 figures. */
  get currencyCode(): string {
    return this.selectedCurrency?.code || '';
  }

  // Display helpers — one money format app-wide (DESIGN_POLICY §1.1). The
  // backend serialises total_value as entity.Money, i.e. display units, so this
  // is the formatAmount family, not formatCents.
  formatMoney(value: number): string {
    return formatAmount(value);
  }

  formatNumber(value: number): string {
    return formatCount(value);
  }

  /** "< 1 дн" / "5 дн" — a stage's average dwell time, in the UI language. */
  formatAvgDays(days: number): string {
    if (days < 1) return this.translation.translate('admin.crm.avgUnderDay');
    return this.translation.translate('admin.crm.avgDays', { count: Math.round(days) });
  }

  formatActivityDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMins < 1) return this.translation.translate('admin.crm.justNow');
    if (diffMins < 60) return this.translation.translate('admin.crm.minutesAgo', { count: diffMins });
    if (diffHours < 24) return this.translation.translate('admin.crm.hoursAgo', { count: diffHours });
    if (diffDays < 7) return this.translation.translate('admin.crm.daysAgo', { count: diffDays });
    return formatDate(date);
  }

  /** Icon-set name for an activity row. Unknown types get the neutral dot —
   *  the timeline still reads as a timeline when the backend adds a type. */
  getActivityIcon(activityType: string): string {
    switch (activityType) {
      case 'stage_change': return 'swap_horiz';
      case 'assignment': return 'person_add';
      case 'unassignment': return 'person_remove';
      case 'note': return 'note';
      case 'task_created': return 'edit';
      case 'task_completed': return 'check_circle';
      case 'order_created': return 'inventory_2';
      default: return 'dot';
    }
  }

  // Active (non-final) stages drive the chart bars; final stages live in their
  // own section below and don't influence the bar scale.
  get activePipelineStats(): CrmPipelineStageStats[] {
    return this.pipelineStats.filter(s => !s.is_final);
  }

  get finalPipelineStats(): CrmPipelineStageStats[] {
    return this.pipelineStats.filter(s => s.is_final);
  }

  /** The bar encodes the value printed at the end of its own row. It used to
   *  encode order_count while the row was labelled with money, so the widest
   *  bar was rarely the largest number on screen. */
  private get maxStageValue(): number {
    const active = this.activePipelineStats;
    if (active.length === 0) return 1;
    return Math.max(...active.map(s => s.total_value), 1);
  }

  getBarWidth(stage: CrmPipelineStageStats): number {
    const pct = (stage.total_value / this.maxStageValue) * 100;
    // A stage holding orders worth nothing (unpriced, fully discounted) still
    // exists; give it a sliver rather than an empty track.
    if (pct <= 0) return stage.order_count > 0 ? 1.5 : 0;
    return pct;
  }

  getMaxWorkload(): number {
    if (this.workloadStats.length === 0) return 1;
    return Math.max(...this.workloadStats.map(w => w.assigned_orders + w.pending_tasks), 1);
  }

  getWorkloadBarWidth(stats: CrmWorkloadStats): number {
    return ((stats.assigned_orders + stats.pending_tasks) / this.getMaxWorkload()) * 100;
  }
}
