import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, forkJoin, timer } from 'rxjs';
import { PageTitleService } from '../../core/services/page-title.service';
import { TranslationService } from '../../core/services/translation.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { NotificationService } from '../../core/services/notification.service';
import { SessionService } from '../../core/services/session.service';
import {
  RuntimeSnapshot,
  SessionEntityType,
  SessionInfo,
  SessionStats,
  SessionStatus
} from '../../core/models/session.model';
import { formatDateShort, formatDateTime } from '../../core/utils/date-format';
import { ToggleState, ExpandState } from '../../core/utils/ui-state';

/** How often the view refreshes itself while auto-refresh is on. */
const REFRESH_INTERVAL_MS = 15_000;

/** A parsed user-agent, reduced to what fits in a table cell. */
interface DeviceInfo {
  browser: string;
  os: string;
  mobile: boolean;
}

@Component({
  selector: 'app-sessions',
  templateUrl: './sessions.component.html',
  styleUrls: ['./sessions.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SessionsComponent implements OnInit, OnDestroy {
  private readonly subscriptions = new Subscription();
  /** Held separately so toggling auto-refresh can cancel just the poll. */
  private pollSubscription: Subscription | null = null;
  /**
   * The in-flight load. Held on its own rather than in the bag: this page is
   * meant to stay open, and a completed subscription is not removed from a
   * parent Subscription, so polling into the bag would grow it without bound.
   * Replacing it also drops a slow response when a newer one is requested.
   */
  private loadSubscription: Subscription | null = null;

  sessions: SessionInfo[] = [];
  stats: SessionStats | null = null;
  runtime: RuntimeSnapshot | null = null;

  loading = false;
  /** True only for the first load, so a poll never blanks the table. */
  initialLoad = true;
  error: string | null = null;
  lastRefresh: Date | null = null;

  currentPage = 1;
  pageSize = 50;
  total = 0;
  totalPages = 1;

  entityTypeFilter: SessionEntityType | '' = '';
  statusFilter: SessionStatus | '' = '';
  searchTerm = '';

  autoRefresh = true;
  /** Runtime panel is opt-in: it is a different question from "who is on". */
  showRuntime = false;

  readonly entityTypeOptions = [
    { value: '', labelKey: 'admin.sessions.allTypes' },
    { value: 'user', labelKey: 'admin.sessions.typeStaff' },
    { value: 'client', labelKey: 'admin.sessions.typeClient' }
  ];

  readonly statusOptions = [
    { value: '', labelKey: 'admin.sessions.allStatuses' },
    { value: 'active', labelKey: 'admin.sessions.statusActive' },
    { value: 'idle', labelKey: 'admin.sessions.statusIdle' },
    { value: 'expired', labelKey: 'admin.sessions.statusExpired' },
    { value: 'revoked', labelKey: 'admin.sessions.statusRevoked' }
  ];

  filters = new ToggleState();
  cards = new ExpandState();

  constructor(
    private readonly sessionService: SessionService,
    private readonly cdr: ChangeDetectorRef,
    private readonly pageTitleService: PageTitleService,
    private readonly translation: TranslationService,
    private readonly confirmDialog: ConfirmDialogService,
    private readonly notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle(this.translation.instant('admin.sessions.title'));
    this.load();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.loadSubscription?.unsubscribe();
    this.subscriptions.unsubscribe();
  }

  /**
   * Fetches the list, the tiles and the runtime snapshot together. The runtime
   * call is made even when its panel is collapsed, because the collapsed
   * header still shows the request rate and in-flight count.
   */
  load(): void {
    if (this.initialLoad) {
      this.loading = true;
    }
    this.error = null;

    this.loadSubscription?.unsubscribe();
    this.loadSubscription = forkJoin({
        list: this.sessionService.list(
          {
            entity_type: this.entityTypeFilter,
            status: this.statusFilter,
            search: this.searchTerm
          },
          this.currentPage,
          this.pageSize
        ),
        stats: this.sessionService.stats(),
        runtime: this.sessionService.runtime()
      }).subscribe({
        next: ({ list, stats, runtime }) => {
          this.sessions = list.data || [];
          this.total = list.metadata?.total ?? this.sessions.length;
          this.totalPages = list.metadata?.total_pages ?? Math.max(1, Math.ceil(this.total / this.pageSize));
          this.stats = stats.data;
          this.runtime = runtime.data;
          this.lastRefresh = new Date();
          this.loading = false;
          this.initialLoad = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load sessions:', err);
          this.error = this.translation.instant('admin.sessions.errLoad');
          this.loading = false;
          this.initialLoad = false;
          this.cdr.detectChanges();
        }
      });
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  toggleRuntime(): void {
    this.showRuntime = !this.showRuntime;
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.load();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.load();
    }
  }

  /** Revokes one session after confirming; warns harder for the caller's own. */
  async revoke(session: SessionInfo): Promise<void> {
    const who = this.accountLabel(session);
    const messageKey = session.is_current
      ? 'admin.sessions.confirmRevokeSelf'
      : 'admin.sessions.confirmRevoke';

    const confirmed = await this.confirmDialog.ask({
      title: this.translation.instant('admin.sessions.revoke'),
      message: `${this.translation.instant(messageKey)} (${who})`,
      confirmLabel: this.translation.instant('admin.sessions.revoke'),
      danger: true
    });
    if (!confirmed) {
      return;
    }

    this.subscriptions.add(
      this.sessionService.revoke([session.token_uid]).subscribe({
        next: () => {
          this.notification.success(this.translation.instant('admin.sessions.revoked'));
          this.load();
        },
        error: (err) => {
          console.error('Failed to revoke session:', err);
          this.notification.error(this.translation.instant('admin.sessions.errRevoke'));
        }
      })
    );
  }

  /** Revokes every session of the account behind a row. */
  async revokeAccount(session: SessionInfo): Promise<void> {
    const who = this.accountLabel(session);

    const confirmed = await this.confirmDialog.ask({
      title: this.translation.instant('admin.sessions.revokeAll'),
      message: `${this.translation.instant('admin.sessions.confirmRevokeAll')} (${who})`,
      confirmLabel: this.translation.instant('admin.sessions.revokeAll'),
      danger: true
    });
    if (!confirmed) {
      return;
    }

    this.subscriptions.add(
      this.sessionService.revokeAccount(session.entity_type, session.entity_uid).subscribe({
        next: () => {
          this.notification.success(this.translation.instant('admin.sessions.revoked'));
          this.load();
        },
        error: (err) => {
          console.error('Failed to revoke account sessions:', err);
          this.notification.error(this.translation.instant('admin.sessions.errRevoke'));
        }
      })
    );
  }

  /** Best available name for the account: display name, else username, else UID. */
  accountLabel(session: SessionInfo): string {
    return session.display_name || session.username || session.entity_uid;
  }

  /**
   * Compact "time since" for the activity column. Absolute timestamps are
   * exact but useless for spotting who is on right now.
   */
  since(iso: string): string {
    const then = new Date(iso).getTime();
    if (isNaN(then)) {
      return '-';
    }

    const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (seconds < 60) {
      return this.translation.instant('admin.sessions.justNow');
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h`;
    }

    return `${Math.floor(hours / 24)}d`;
  }

  /**
   * Reduces a user-agent string to browser + OS. Deliberately crude: the
   * point is telling one of an admin's devices from another, not analytics.
   */
  device(userAgent?: string): DeviceInfo {
    if (!userAgent) {
      return { browser: '-', os: '', mobile: false };
    }

    const mobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);

    // Order matters: Edge and Opera both claim Chrome, Chrome claims Safari.
    let browser = 'Other';
    if (/Edg\//.test(userAgent)) {
      browser = 'Edge';
    } else if (/OPR\/|Opera/.test(userAgent)) {
      browser = 'Opera';
    } else if (/Firefox\//.test(userAgent)) {
      browser = 'Firefox';
    } else if (/Chrome\//.test(userAgent)) {
      browser = 'Chrome';
    } else if (/Safari\//.test(userAgent)) {
      browser = 'Safari';
    } else if (/curl|okhttp|python|Go-http/i.test(userAgent)) {
      browser = 'API client';
    }

    let os = '';
    if (/Windows/.test(userAgent)) {
      os = 'Windows';
    } else if (/Android/.test(userAgent)) {
      os = 'Android';
    } else if (/iPhone|iPad|iOS/.test(userAgent)) {
      os = 'iOS';
    } else if (/Mac OS X|Macintosh/.test(userAgent)) {
      os = 'macOS';
    } else if (/Linux/.test(userAgent)) {
      os = 'Linux';
    }

    return { browser, os, mobile };
  }

  deviceLabel(userAgent?: string): string {
    const info = this.device(userAgent);
    return info.os ? `${info.browser} · ${info.os}` : info.browser;
  }

  deviceIcon(userAgent?: string): string {
    return this.device(userAgent).mobile ? 'smartphone' : 'desktop_windows';
  }

  /** Tallest bar in the histogram, used to scale the rest. */
  get peakHour(): number {
    if (!this.stats?.hourly?.length) {
      return 0;
    }
    return this.stats.hourly.reduce((max, bucket) => Math.max(max, bucket.count), 0);
  }

  barHeight(count: number): string {
    const peak = this.peakHour;
    if (peak <= 0) {
      return '0%';
    }
    // Floor at 4% so a non-zero hour is still visible against the baseline.
    return `${Math.max(4, Math.round((count / peak) * 100))}%`;
  }

  hourLabel(iso: string): string {
    const date = new Date(iso);
    return isNaN(date.getTime()) ? '' : String(date.getHours()).padStart(2, '0');
  }

  formatDateTime(iso?: string): string {
    return formatDateTime(iso);
  }

  formatDateShort(iso?: string): string {
    return formatDateShort(iso);
  }

  /** Uptime as "3d 4h" / "4h 12m" / "12m". */
  formatUptime(seconds: number): string {
    const total = Math.floor(seconds);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  percent(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`;
  }

  /**
   * Share of the pool currently checked out, for the usage bar. An unlimited
   * pool (max_open = 0) has no meaningful share.
   */
  poolUsage(): number {
    const db = this.runtime?.db;
    if (!db || db.max_open <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((db.in_use / db.max_open) * 100));
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollSubscription = timer(REFRESH_INTERVAL_MS, REFRESH_INTERVAL_MS)
      .subscribe(() => this.load());
    this.subscriptions.add(this.pollSubscription);
  }

  private stopPolling(): void {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
      this.subscriptions.remove(this.pollSubscription);
      this.pollSubscription = null;
    }
  }
}
