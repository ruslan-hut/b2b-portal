import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { forkJoin, of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { Store } from '../../../core/models/store.model';
import { StoreService } from '../../../core/services/store.service';
import { PriceType } from '../../../core/models/price-type.model';
import { PriceTypeService } from '../../../core/services/price-type.service';
import { ClientService, Country } from '../../../core/services/client.service';
import { InvoiceService, InvoiceType, InvoiceTypesResponse } from '../../../core/services/invoice.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslationService } from '../../../core/services/translation.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { AuthService } from '../../../core/services/auth.service';
import { CrmService } from '../../crm/services/crm.service';
import { CrmStage } from '../../crm/models/crm-stage.model';
import { formatDateTime } from '../../../core/utils/date-format';
import { CriterionOption, CriterionSelection } from '../../../shared/components/filter-criterion/filter-criterion.component';
import { MenuItem } from '../../../shared/components/menu-bar/menu-bar.component';

/** One row of the analysis listing, as returned by /admin/orders/analysis. */
export interface OrderAnalysisRow {
  uid: string;
  number?: string;
  created_at: string;
  client_uid: string;
  client_name?: string;
  store_uid?: string;
  price_type_uid?: string;
  country_code?: string;
  status: string;
  stage_uid?: string;
  stage_name?: string;
  is_final: boolean;
  currency_code?: string;
  total: number;
  discount_percent: number;
  vat_rate: number;
  invoice_types?: string[];
  has_shipment: boolean;
}

/** The criteria the rail can carry, in the order they are shown. */
type CriterionKey = 'stages' | 'invoiceTypes' | 'priceTypes' | 'clients' | 'countries';

/** The slice of a client the criterion list needs. */
interface ClientOption {
  uid: string;
  name: string;
}

/** Every criterion, in one place, so URL round-tripping cannot miss one. */
const CRITERION_KEYS: CriterionKey[] = ['stages', 'invoiceTypes', 'priceTypes', 'clients', 'countries'];

/**
 * Criteria travel in the URL as a comma-joined value list, prefixed with "!"
 * when the selection is an exclusion — `invoiceTypes=!faktura-uid` reads as
 * "without a Faktura". Compact enough to stay legible in the address bar.
 */
const EXCLUDE_PREFIX = '!';

function encodeCriterion(selection: CriterionSelection): string | null {
  if (!selection.values.length) {
    return null;
  }
  return (selection.exclude ? EXCLUDE_PREFIX : '') + selection.values.join(',');
}

function parseCriterion(raw: unknown): CriterionSelection {
  if (typeof raw !== 'string' || !raw) {
    return { values: [], exclude: false };
  }
  const exclude = raw.startsWith(EXCLUDE_PREFIX);
  const values = (exclude ? raw.slice(EXCLUDE_PREFIX.length) : raw)
    .split(',')
    .filter(v => !!v);
  // An exclusion of nothing is not an exclusion: drop the flag with the values
  // so a malformed "!"-only param cannot leave the rail in a phantom state.
  return values.length ? { values, exclude } : { values: [], exclude: false };
}

/** Mirrors entity.OrderAnalysisMaxRows on the backend. */
const EXPORT_MAX_ROWS = 5000;

/** How many clients the criterion list will load before it truncates. */
const CLIENT_OPTION_LIMIT = 1000;

/**
 * Invoicing analysis: a query builder over confirmed orders, answering
 * document-coverage questions the operational orders list cannot — above all
 * "which orders still have no Faktura", which is an exclusion over invoice
 * types and therefore has to be resolved in SQL, not by scanning a page.
 *
 * It is a separate page rather than more filters on /admin/orders because the
 * two screens have different jobs: that list is a daily work queue with
 * single-select filters, this one is a wide, exportable result set built from
 * include/exclude sets. Merging them would have pushed eleven controls onto
 * every manager who only ever wanted "show me stage X".
 */
@Component({
  selector: 'app-order-analysis',
  templateUrl: './order-analysis.component.html',
  styleUrls: ['./order-analysis.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderAnalysisComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private searchInput$ = new Subject<string>();

  menuItems: MenuItem[] = [];

  rows: OrderAnalysisRow[] = [];
  loading = false;
  exporting = false;
  error: string | null = null;

  currentPage = 1;
  pageSize = 50;
  total = 0;
  totalPages = 1;

  readonly exportMaxRows = EXPORT_MAX_ROWS;

  // ---- Criteria -----------------------------------------------------------
  // Excluding the final stage is the page's premise, not an afterthought: the
  // point is to inspect orders still in flight, so it starts on.
  excludeFinalStages = true;
  storeFilter = '';
  storeLocked = false;
  searchTerm = '';

  selections: Record<CriterionKey, CriterionSelection> = {
    stages: { values: [], exclude: false },
    invoiceTypes: { values: [], exclude: false },
    priceTypes: { values: [], exclude: false },
    clients: { values: [], exclude: false },
    countries: { values: [], exclude: false }
  };

  /** Only one criterion is open at a time so the rail stays one screen tall. */
  openCriterion: CriterionKey | null = null;

  stageOptions: CriterionOption[] = [];
  invoiceTypeOptions: CriterionOption[] = [];
  priceTypeOptions: CriterionOption[] = [];
  clientOptions: CriterionOption[] = [];
  countryOptions: CriterionOption[] = [];
  storeOptions: { value: string; label: string }[] = [];

  clientsNote = '';

  // ---- Display lookups ----------------------------------------------------
  private stores: { [uid: string]: Store } = {};
  private priceTypes: { [uid: string]: PriceType } = {};
  private stageColors: { [stageName: string]: string } = {};
  private countryNames: { [code: string]: string } = {};

  constructor(
    private http: HttpClient,
    private storeService: StoreService,
    private priceTypeService: PriceTypeService,
    private clientService: ClientService,
    private invoiceService: InvoiceService,
    private crmService: CrmService,
    private translationService: TranslationService,
    private notifications: NotificationService,
    private pageTitleService: PageTitleService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('Order Analysis');
    this.menuItems = [
      { icon: 'receipt', label: this.translationService.translate('admin.orders.allOrders'), route: '/admin/orders', exactMatch: true },
      { icon: 'fact_check', label: this.translationService.translate('admin.analysis.title'), route: '/admin/orders/analysis' }
    ];

    this.storeLocked = this.authService.isStoreScopedManager();
    if (this.storeLocked) {
      this.storeFilter = this.authService.scopedStoreUid ?? '';
    }

    this.subscriptions.add(
      this.searchInput$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
        this.applyCriteria();
      })
    );

    // The URL is the single source of truth for the criteria, so returning to
    // this page — via the browser's back button, the order detail's back
    // button, or a shared link — restores the exact query that was being asked.
    // Every criteria change navigates; this subscription is the one place that
    // turns a URL into state and reloads.
    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        this.hydrateFromParams(params);
        this.load();
      })
    );

    this.loadOptions();
  }

  /** Reads the criteria out of the URL. Absent params fall back to defaults. */
  private hydrateFromParams(params: Params): void {
    const selections = {} as Record<CriterionKey, CriterionSelection>;
    CRITERION_KEYS.forEach(key => {
      selections[key] = parseCriterion(params[key]);
    });
    this.selections = selections;

    // Absent means "on": excluding the final stage is the page's default premise.
    this.excludeFinalStages = params['final'] !== '0';
    if (!this.storeLocked) {
      this.storeFilter = params['store'] || '';
    }
    // Only overwrite the field when the URL genuinely disagrees with it. The
    // URL holds the trimmed term, so a blind assignment would yank trailing
    // whitespace out from under someone still typing.
    const search = params['q'] || '';
    if (search !== this.searchTerm.trim()) {
      this.searchTerm = search;
    }

    const page = Number(params['page']);
    this.currentPage = Number.isInteger(page) && page > 0 ? page : 1;
    this.cdr.markForCheck();
  }

  /** Serialises the current criteria, omitting everything left at its default. */
  private toQueryParams(): Params {
    const params: Params = {};
    CRITERION_KEYS.forEach(key => {
      const encoded = encodeCriterion(this.selections[key]);
      if (encoded) {
        params[key] = encoded;
      }
    });
    if (!this.excludeFinalStages) {
      params['final'] = '0';
    }
    if (this.storeFilter && !this.storeLocked) {
      params['store'] = this.storeFilter;
    }
    const search = this.searchTerm.trim();
    if (search) {
      params['q'] = search;
    }
    if (this.currentPage > 1) {
      params['page'] = String(this.currentPage);
    }
    return params;
  }

  /**
   * Pushes the current criteria into the URL, which then feeds them back
   * through the queryParams subscription and triggers the reload.
   *
   * replaceUrl keeps a session of filter tweaking from filling the history
   * stack — pressing back should leave the page, not walk backwards through
   * every checkbox that was ticked.
   */
  private applyCriteria(resetPage = true): void {
    if (resetPage) {
      this.currentPage = 1;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.toQueryParams(),
      replaceUrl: true
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Loads every criterion's option set. Each source is allowed to fail on its
   * own: a page that cannot list countries is still useful for the invoice-type
   * question, so a single failing lookup must not blank the whole screen.
   */
  private loadOptions(): void {
    this.loading = true;
    this.subscriptions.add(
      forkJoin({
        stores: this.storeService.getStores().pipe(catchError(() => of({} as { [uid: string]: Store }))),
        priceTypes: this.priceTypeService.getPriceTypes().pipe(catchError(() => of({} as { [uid: string]: PriceType }))),
        stages: this.crmService.getStages().pipe(catchError(() => of([] as CrmStage[]))),
        invoiceTypes: this.invoiceService.listTypes(1, 200).pipe(
          catchError(() => of({ success: false, data: [] } as InvoiceTypesResponse))
        ),
        countries: this.clientService.getCountries().pipe(catchError(() => of([] as Country[]))),
        clients: this.http.get<ApiResponse<ClientOption[]>>(
          `${environment.apiUrl}/admin/clients?page=1&count=${CLIENT_OPTION_LIMIT}`
        ).pipe(catchError(() => of({ status: 'error', data: [] } as ApiResponse<ClientOption[]>)))
      }).subscribe(({ stores, priceTypes, stages, invoiceTypes, countries, clients }) => {
        this.stores = stores;
        this.priceTypes = priceTypes;

        // Copy before sorting: getStages() hands every subscriber the same
        // cached array, so sorting in place would reorder the CRM board too.
        this.stageOptions = [...stages]
          .filter(stage => stage.active)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(stage => ({
            value: stage.uid,
            label: this.localizedStageName(stage),
            hint: stage.is_final ? this.translationService.translate('admin.analysis.finalStage') : undefined
          }));
        // Inactive stages keep their colour so orders parked in a retired stage
        // still render consistently.
        this.stageColors = {};
        stages.forEach(stage => {
          if (stage.color) {
            this.stageColors[stage.name] = stage.color;
          }
        });

        this.invoiceTypeOptions = (invoiceTypes.data ?? [])
          .map((t: InvoiceType): CriterionOption => ({ value: t.uid, label: t.name }))
          .sort((a, b) => a.label.localeCompare(b.label));

        this.priceTypeOptions = Object.values(priceTypes)
          .map(pt => ({ value: pt.uid, label: pt.name }))
          .sort((a, b) => a.label.localeCompare(b.label));

        this.countryNames = {};
        countries.forEach(c => (this.countryNames[c.country_code] = c.name));
        this.countryOptions = countries
          .map(c => ({ value: c.country_code, label: c.name, hint: c.country_code }))
          .sort((a, b) => a.label.localeCompare(b.label));

        const clientList = clients.data ?? [];
        this.clientOptions = clientList
          .map(c => ({ value: c.uid, label: c.name || c.uid }))
          .sort((a, b) => a.label.localeCompare(b.label));
        // Say so rather than silently offering a partial list.
        const clientTotal = clients.pagination?.total ?? clientList.length;
        this.clientsNote = clientTotal > clientList.length
          ? this.translationService.translate('admin.analysis.clientsTruncated')
          : '';

        this.storeOptions = [
          { value: '', label: this.translationService.translate('admin.analysis.allStores') },
          ...Object.values(stores)
            .map(s => ({ value: s.uid, label: s.name }))
            .sort((a, b) => a.label.localeCompare(b.label))
        ];

        // No load() here: options only supply labels, and the queryParams
        // subscription already owns when the listing is fetched.
        this.cdr.detectChanges();
      })
    );
  }

  /** The filter payload sent to the backend, built from the current criteria. */
  private buildFilter(): Record<string, unknown> {
    return {
      stage_uids: this.selections.stages.values,
      exclude_stages: this.selections.stages.exclude,
      exclude_final_stages: this.excludeFinalStages,
      store_uid: this.storeFilter || undefined,
      price_type_uids: this.selections.priceTypes.values,
      exclude_price_types: this.selections.priceTypes.exclude,
      client_uids: this.selections.clients.values,
      exclude_clients: this.selections.clients.exclude,
      country_codes: this.selections.countries.values,
      exclude_countries: this.selections.countries.exclude,
      invoice_type_uids: this.selections.invoiceTypes.values,
      exclude_invoice_types: this.selections.invoiceTypes.exclude,
      search: this.searchTerm.trim() || undefined
    };
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.subscriptions.add(
      this.http.post<ApiResponse<OrderAnalysisRow[]>>(`${environment.apiUrl}/admin/orders/analysis`, {
        data: this.buildFilter(),
        page: this.currentPage,
        count: this.pageSize
      }).subscribe({
        next: response => {
          this.rows = response.data || [];
          this.total = response.pagination?.total ?? this.rows.length;
          this.totalPages = response.pagination?.total_pages ?? Math.ceil(this.total / this.pageSize);
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: err => {
          console.error('Failed to analyze orders:', err);
          this.error = this.translationService.translate('admin.analysis.loadFailed');
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  // ---- Criterion plumbing -------------------------------------------------

  onSelectionChange(key: CriterionKey, selection: CriterionSelection): void {
    this.selections = { ...this.selections, [key]: selection };
    this.applyCriteria();
  }

  onCriterionExpanded(key: CriterionKey, expanded: boolean): void {
    this.openCriterion = expanded ? key : null;
    this.cdr.markForCheck();
  }

  isOpen(key: CriterionKey): boolean {
    return this.openCriterion === key;
  }

  onFilterChange(): void {
    this.applyCriteria();
  }

  onSearchChange(): void {
    this.searchInput$.next(this.searchTerm);
  }

  /** True when anything narrows the result set beyond the page's own premise. */
  get hasActiveCriteria(): boolean {
    return !this.excludeFinalStages
      || (!!this.storeFilter && !this.storeLocked)
      || !!this.searchTerm.trim()
      || Object.values(this.selections).some(s => s.values.length > 0);
  }

  /**
   * True when the criteria cancel each other out: a final stage is explicitly
   * included while the premise excludes final stages, which can only ever
   * return nothing. The two are ANDed like every other pair of criteria, so
   * rather than quietly overriding one, the rail says what is happening.
   */
  get hasFinalStageConflict(): boolean {
    if (!this.excludeFinalStages || this.selections.stages.exclude) {
      return false;
    }
    const finalUIDs = new Set(this.stageOptions.filter(o => !!o.hint).map(o => o.value));
    return this.selections.stages.values.some(uid => finalUIDs.has(uid));
  }

  resetCriteria(): void {
    this.selections = {
      stages: { values: [], exclude: false },
      invoiceTypes: { values: [], exclude: false },
      priceTypes: { values: [], exclude: false },
      clients: { values: [], exclude: false },
      countries: { values: [], exclude: false }
    };
    this.excludeFinalStages = true;
    this.searchTerm = '';
    if (!this.storeLocked) {
      this.storeFilter = '';
    }
    this.applyCriteria();
  }

  // ---- Display ------------------------------------------------------------

  getStoreName(uid?: string): string {
    return uid ? this.stores[uid]?.name || uid : '—';
  }

  getPriceTypeName(uid?: string): string {
    return uid ? this.priceTypes[uid]?.name || uid : '—';
  }

  getCountryName(code?: string): string {
    return code ? this.countryNames[code] || code : '—';
  }

  getStageColor(row: OrderAnalysisRow): string | null {
    return this.stageColors[row.stage_name || row.status] || null;
  }

  formatDate(value: string): string {
    return formatDateTime(value);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyCriteria(false);
    }
  }

  /**
   * Opens an order, handing the detail page the URL to come back to. Without
   * it, "back" would land on the plain orders list and the criteria that
   * produced this row would be gone.
   */
  viewOrder(row: OrderAnalysisRow): void {
    this.router.navigate(['/admin/orders', row.uid], {
      queryParams: { from: 'analysis', returnUrl: this.router.url }
    });
  }

  private localizedStageName(stage: CrmStage): string {
    const lang = this.translationService.getCurrentLanguage();
    const match = (stage.translations || []).find(t => t.language === lang && !!t.name);
    return match?.name || stage.name;
  }

  // ---- Export -------------------------------------------------------------

  /**
   * Exports the whole matching result set, not just the page on screen — an
   * analysis is about the set, and exporting 50 of 800 rows would be a quiet
   * lie. The backend caps a single response at EXPORT_MAX_ROWS, so anything
   * beyond that is truncated; the user is told before the file is written
   * rather than discovering it in Excel.
   */
  async exportToExcel(): Promise<void> {
    if (this.exporting || this.total === 0) {
      return;
    }
    this.exporting = true;
    this.cdr.markForCheck();

    this.subscriptions.add(
      this.http.post<ApiResponse<OrderAnalysisRow[]>>(`${environment.apiUrl}/admin/orders/analysis`, {
        data: this.buildFilter(),
        page: 1,
        count: EXPORT_MAX_ROWS
      }).subscribe({
        next: response => {
          const rows = response.data || [];
          const total = response.pagination?.total ?? rows.length;
          this.writeWorkbook(rows);
          if (total > rows.length) {
            this.notifications.warning(
              this.translationService
                .translate('admin.analysis.exportTruncated')
                .replace('{exported}', String(rows.length))
                .replace('{total}', String(total))
            );
          }
          this.exporting = false;
          this.cdr.detectChanges();
        },
        error: err => {
          console.error('Failed to export analysis:', err);
          this.notifications.error(this.translationService.translate('admin.analysis.exportFailed'));
          this.exporting = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  private writeWorkbook(rows: OrderAnalysisRow[]): void {
    const t = (key: string) => this.translationService.translate(key);
    const data: (string | number)[][] = [[
      t('common.created'),
      t('orders.orderNumber'),
      t('common.status'),
      t('admin.orders.clientName'),
      t('common.store'),
      t('common.priceType'),
      t('admin.analysis.country'),
      t('common.discount'),
      t('common.vatRate'),
      t('orders.totalGross'),
      t('common.currency'),
      t('invoice.title'),
      t('admin.orders.shipments')
    ]];

    rows.forEach(row => {
      data.push([
        this.formatDate(row.created_at),
        row.number || row.uid,
        row.stage_name || row.status,
        row.client_name || row.client_uid,
        this.getStoreName(row.store_uid),
        this.getPriceTypeName(row.price_type_uid),
        this.getCountryName(row.country_code),
        `${row.discount_percent}%`,
        `${row.vat_rate}%`,
        // Totals are stored in cents everywhere in the app.
        Number((row.total / 100).toFixed(2)),
        row.currency_code || '',
        (row.invoice_types || []).join(', '),
        row.has_shipment ? t('common.yes') : ''
      ]);
    });

    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 18 },
      { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
      { wch: 10 }, { wch: 24 }, { wch: 12 }
    ];
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `order_analysis_${stamp}.xlsx`);
  }
}
