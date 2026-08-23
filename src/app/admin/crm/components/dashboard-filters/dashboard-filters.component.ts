import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  output
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '../../../../core/models/store.model';
import { StoreService } from '../../../../core/services/store.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CrmService, CrmAssignableUser } from '../../services/crm.service';
import { CurrencyService } from '../../../../core/services/currency.service';
import { Currency } from '../../../../core/models/currency.model';
import { CrmDashboardFilters } from '../../models/crm-dashboard.model';
import {
  CrmFiltersState,
  CrmFiltersStateService,
  CrmFilterPeriod
} from '../../services/crm-filters-state.service';

export interface CrmFiltersEmit {
  filters: CrmDashboardFilters;
  state: CrmFiltersState;
  currency?: Currency;
}

interface PeriodOption {
  key: CrmFilterPeriod;
  labelKey: string;
}

@Component({
  selector: 'app-dashboard-filters',
  templateUrl: './dashboard-filters.component.html',
  styleUrls: ['./dashboard-filters.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardFiltersComponent implements OnInit {
  private readonly storeService = inject(StoreService);
  private readonly authService = inject(AuthService);
  private readonly crmService = inject(CrmService);
  private readonly currencyService = inject(CurrencyService);
  private readonly stateService = inject(CrmFiltersStateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly scope = input.required<string>();
  readonly showCurrency = input<boolean>(false);

  readonly filtersChange = output<CrmFiltersEmit>();

  state: CrmFiltersState = {
    storeUid: '',
    assigneeUid: '',
    period: 'all',
    dateFrom: '',
    dateTo: '',
    currencyCode: ''
  };

  stores: Store[] = [];
  assignableUsers: CrmAssignableUser[] = [];
  currencies: Currency[] = [];

  loading = false;
  // True when a store-scoped manager is logged in: store filter is locked.
  storeLocked = false;

  readonly periodOptions: PeriodOption[] = [
    { key: 'today', labelKey: 'admin.crm.periodToday' },
    { key: '7d', labelKey: 'admin.crm.period7d' },
    { key: '30d', labelKey: 'admin.crm.period30d' },
    { key: '90d', labelKey: 'admin.crm.period90d' },
    { key: 'all', labelKey: 'admin.crm.periodAll' },
    { key: 'custom', labelKey: 'admin.crm.periodCustom' }
  ];

  ngOnInit(): void {
    this.state = this.stateService.load(this.scope());
    // Store-scoped managers are locked to their own store.
    this.storeLocked = this.authService.isStoreScopedManager();
    if (this.storeLocked) {
      this.state.storeUid = this.authService.scopedStoreUid ?? '';
    }
    this.loadFilterOptions();
  }

  private loadFilterOptions(): void {
    this.loading = true;

    this.storeService.getStores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: storesMap => {
          this.stores = Object.values(storesMap)
            .filter(s => s.active !== false)
            .sort((a, b) => a.name.localeCompare(b.name));
          this.cdr.markForCheck();
        },
        error: err => console.error('Failed to load stores:', err)
      });

    this.crmService.getAssignableUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: users => {
          this.assignableUsers = users;
          this.loading = false;
          this.cdr.markForCheck();
          this.emit();
        },
        error: err => {
          console.error('Failed to load assignable users:', err);
          this.loading = false;
          this.cdr.markForCheck();
          this.emit();
        }
      });

    if (this.showCurrency()) {
      this.currencyService.getCurrencies()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: list => {
            this.currencies = (list || []).slice().sort((a, b) => a.code.localeCompare(b.code));
            if (!this.state.currencyCode && this.currencies.length) {
              const usd = this.currencies.find(c => c.code === 'USD');
              this.state.currencyCode = usd ? usd.code : this.currencies[0].code;
              this.persistAndEmit();
            } else {
              // Re-emit so consumers receive the resolved Currency object
              // (selectedCurrency was undefined when filters first emitted
              // before the currencies list arrived).
              this.cdr.markForCheck();
              this.emit();
            }
          },
          error: err => console.error('Failed to load currencies:', err)
        });
    }
  }

  selectPeriod(period: CrmFilterPeriod): void {
    this.state.period = period;
    if (period !== 'custom') {
      this.state.dateFrom = '';
      this.state.dateTo = '';
    }
    this.persistAndEmit();
  }

  onStoreChange(): void { this.persistAndEmit(); }
  onAssigneeChange(): void { this.persistAndEmit(); }
  onCurrencyChange(): void { this.persistAndEmit(); }
  onCustomDateChange(): void {
    this.state.period = 'custom';
    this.persistAndEmit();
  }

  clearAll(): void {
    this.state = {
      storeUid: '',
      assigneeUid: '',
      period: 'all',
      dateFrom: '',
      dateTo: '',
      currencyCode: this.state.currencyCode
    };
    this.persistAndEmit();
  }

  get hasActiveFilters(): boolean {
    return !!(this.state.storeUid || this.state.assigneeUid || this.state.period !== 'all');
  }

  getUserDisplayName(user: CrmAssignableUser): string {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.username || user.email;
  }

  get selectedCurrency(): Currency | undefined {
    return this.currencies.find(c => c.code === this.state.currencyCode);
  }

  private persistAndEmit(): void {
    this.stateService.save(this.scope(), this.state);
    this.cdr.markForCheck();
    this.emit();
  }

  private emit(): void {
    this.filtersChange.emit({
      filters: this.toFilters(),
      state: { ...this.state },
      currency: this.selectedCurrency
    });
  }

  private toFilters(): CrmDashboardFilters {
    const f: CrmDashboardFilters = {};
    if (this.state.storeUid) f.storeUid = this.state.storeUid;
    if (this.state.assigneeUid) f.assigneeUid = this.state.assigneeUid;
    if (this.showCurrency() && this.state.currencyCode) {
      f.currencyCode = this.state.currencyCode;
    }

    const range = this.computeDateRange();
    if (range.from) f.dateFrom = range.from;
    if (range.to) f.dateTo = range.to;
    return f;
  }

  private computeDateRange(): { from?: string; to?: string } {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (this.state.period) {
      case 'today':
        return { from: startOfToday.toISOString(), to: endOfToday.toISOString() };
      case '7d':
        return { from: this.daysAgo(7).toISOString(), to: endOfToday.toISOString() };
      case '30d':
        return { from: this.daysAgo(30).toISOString(), to: endOfToday.toISOString() };
      case '90d':
        return { from: this.daysAgo(90).toISOString(), to: endOfToday.toISOString() };
      case 'custom': {
        const out: { from?: string; to?: string } = {};
        if (this.state.dateFrom) out.from = new Date(this.state.dateFrom + 'T00:00:00').toISOString();
        if (this.state.dateTo) out.to = new Date(this.state.dateTo + 'T23:59:59').toISOString();
        return out;
      }
      case 'all':
      default:
        return {};
    }
  }

  private daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
