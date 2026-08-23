import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Currency } from '../../core/models/currency.model';
import { CurrencyService } from '../../core/services/currency.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { NotificationService } from '../../core/services/notification.service';
import { Store } from '../../core/models/store.model';
import { StoreService } from '../../core/services/store.service';
import { UserService, SelectOption } from '../../core/services/user.service';
import { CrmService } from '../crm/services/crm.service';
import { CrmStage } from '../crm/models/crm-stage.model';
import { TranslationService } from '../../core/services/translation.service';
import { formatDateTime } from '../../core/utils/date-format';
import { ToggleState, ExpandState } from '../../core/utils/ui-state';
import { forkJoin, of, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { PageTitleService } from '../../core/services/page-title.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';
import { ApiResponse } from '../../core/models/api.model';
import { MenuItem } from '../../shared/components/menu-bar/menu-bar.component';

export interface AdminOrder {
  uid: string;
  number?: string;
  client_uid: string;
  store_uid: string;
  price_type_uid: string;
  currency_code: string;
  status: string;
  total: number;
  discount_percent?: number; // Client discount percentage (0-100)
  vat_rate?: number; // VAT rate percentage (0-100)
  subtotal?: number; // Subtotal without VAT
  total_vat?: number; // Total VAT amount
  shipping_address: string;
  billing_address?: string;
  comment?: string;
  // Document number the ERP assigns once it has processed the order. ERP-owned
  // and read-only; the list search matches on it, so the list also shows it.
  erp_number?: string;
  created_at: string;
  last_update?: string;
}

/**
 * Per-order summary of the documents attached to an order, loaded in one batch
 * per page so the list can show invoice types and a shipment mark without
 * fetching full invoice/shipment records per row.
 */
export interface OrderMarks {
  order_uid: string;
  /** Distinct invoice type names, oldest issued first (e.g. Proforma, Faktura). */
  invoice_types?: string[];
  has_shipment: boolean;
}

@Component({
    selector: 'app-orders',
    templateUrl: './orders.component.html',
    styleUrls: ['./orders.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  // Search runs server-side, so keystrokes are debounced into one request.
  private searchInput$ = new Subject<string>();

  menuItems: MenuItem[] = [];

  orders: AdminOrder[] = [];
  filteredOrders: AdminOrder[] = [];
  loading = false;
  error: string | null = null;
  isAdmin = false;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;

  // Filters
  // The list shows CRM pipeline orders by default. Order statuses mirror stage
  // names, but the filter matches on the stage UID so renaming a stage does not
  // break it.
  stageFilter: string = '';
  // Drafts are carts, not pipeline work: they are hidden until asked for, and
  // asking for them replaces the pipeline list rather than adding to it.
  showDrafts = false;
  searchTerm = '';
  storeFilter: string = '';
  // True when a store-scoped manager is logged in: store filter is locked.
  storeLocked = false;
  managerFilter: string = '';

  // Mobile UI state
  filters = new ToggleState();
  cards = new ExpandState();

  // Filter Options
  stageOptions: { value: string; label: string; }[] = [];
  storeOptions: { value: string; label: string; }[] = [];
  managerOptions: { value: string; label: string; }[] = [];

  // Data maps
  currencies: { [code: string]: Currency } = {};
  stores: { [uid: string]: Store } = {};
  clients: { [uid: string]: any } = {};
  marks: { [orderUid: string]: OrderMarks } = {};
  // Stage colour keyed by stage name: an order's status string is the name of
  // the CRM stage it sits in, which is the only link the list rows carry back
  // to the stage the colour is configured on.
  stageColors: { [stageName: string]: string } = {};
  // Sequence number of the in-flight marks request, so an out-of-order response
  // cannot overwrite the marks of a newer page.
  private marksRequestId = 0;

  constructor(
    private http: HttpClient,
    private currencyService: CurrencyService,
    private storeService: StoreService,
    private userService: UserService,
    private crmService: CrmService,
    private translationService: TranslationService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService,
    private authService: AuthService,
    private confirmDialog: ConfirmDialogService,
    private notifications: NotificationService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('Orders');

    this.menuItems = [
      { icon: 'receipt', label: this.translationService.translate('admin.orders.allOrders'), route: '/admin/orders', exactMatch: true },
      { icon: 'fact_check', label: this.translationService.translate('admin.analysis.title'), route: '/admin/orders/analysis' }
    ];

    // Check if user is admin
    this.subscriptions.add(
      this.authService.currentEntity$.subscribe(entity => {
        if (entity && this.authService.entityTypeValue === 'user') {
          const user = entity as User;
          this.isAdmin = user?.role === 'admin';
          this.cdr.markForCheck();
        } else {
          this.isAdmin = false;
          this.cdr.markForCheck();
        }
      })
    );

    // Store-scoped managers are locked to their own store.
    this.storeLocked = this.authService.isStoreScopedManager();
    if (this.storeLocked) {
      this.storeFilter = this.authService.scopedStoreUid ?? '';
    }

    this.subscriptions.add(
      this.searchInput$
        .pipe(debounceTime(300), distinctUntilChanged())
        .subscribe(() => this.applyFilters())
    );

    // The URL is the single source of truth for the filters, so opening an
    // order and coming back — or refreshing, or sharing the link — restores the
    // list the user was actually looking at. Every filter change navigates;
    // this subscription is the one place that turns a URL into state and
    // reloads.
    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        this.hydrateFromParams(params);
        this.loadOrders();
      })
    );

    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** Reads the filters out of the URL. Absent params fall back to defaults. */
  private hydrateFromParams(params: Params): void {
    this.showDrafts = params['drafts'] === '1';
    // The stage filter only means something within the pipeline scope, so it is
    // dropped rather than carried while drafts are being shown.
    this.stageFilter = this.showDrafts ? '' : (params['stage'] || '');
    if (!this.storeLocked) {
      this.storeFilter = params['store'] || '';
    }
    this.managerFilter = params['manager'] || '';

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

  /** Serialises the current filters, omitting everything left at its default. */
  private toQueryParams(): Params {
    const params: Params = {};
    if (this.showDrafts) {
      params['drafts'] = '1';
    } else if (this.stageFilter) {
      params['stage'] = this.stageFilter;
    }
    if (this.storeFilter && !this.storeLocked) {
      params['store'] = this.storeFilter;
    }
    if (this.managerFilter) {
      params['manager'] = this.managerFilter;
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
   * Pushes the current filters into the URL, which then feeds them back through
   * the queryParams subscription and triggers the reload.
   *
   * replaceUrl keeps a session of filter tweaking from filling the history
   * stack — pressing back should leave the page, not walk backwards through
   * every dropdown that was touched.
   */
  private applyFilters(resetPage = true): void {
    if (resetPage) {
      this.currentPage = 1;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.toQueryParams(),
      replaceUrl: true
    });
  }

  loadInitialData(): void {
    this.loading = true;
    this.subscriptions.add(
      forkJoin({
        stores: this.storeService.getStores(),
        managers: this.userService.getManagerOptions(),
        stages: this.crmService.getStages()
      }).subscribe({
        next: ({ stores, managers, stages }) => {
          this.stores = stores;

          this.stageOptions = [
            { value: '', label: this.translationService.translate('admin.orders.allStages') },
            // Copy before sorting: getStages() hands every subscriber the same
            // cached array, so sorting in place would reorder the CRM board too.
            ...[...stages]
              .filter(stage => stage.active)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(stage => ({ value: stage.uid, label: this.localizedStageName(stage) }))
          ];
          // Inactive stages are included: orders parked in a stage that was
          // later deactivated should keep their colour.
          this.stageColors = {};
          stages.forEach(stage => {
            if (stage.color) {
              this.stageColors[stage.name] = stage.color;
            }
          });
          this.storeOptions = [
            { value: '', label: 'All Stores' },
            ...Object.values(stores).map(s => ({ value: s.uid, label: s.name })).sort((a, b) => a.label.localeCompare(b.label))
          ];
          this.managerOptions = [
            { value: '', label: 'All Managers' },
            ...[...managers].sort((a, b) => a.label.localeCompare(b.label))
          ];
          // No loadOrders() here: the filter options only supply labels, and
          // the queryParams subscription already owns when the list is fetched.
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load filter data:', err);
          this.error = 'Failed to load filter data';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  loadOrders(): void {
    this.loading = true;
    this.error = null;

    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('count', this.pageSize.toString());

    // Drafts live outside the pipeline, so the two scopes are exclusive and the
    // stage filter only means something within the pipeline scope.
    if (this.showDrafts) {
      params = params.set('scope', 'drafts');
    } else {
      params = params.set('scope', 'pipeline');
      if (this.stageFilter) {
        params = params.set('stage_uid', this.stageFilter);
      }
    }
    if (this.storeFilter) {
      params = params.set('store_uid', this.storeFilter);
    }
    if (this.managerFilter) {
      params = params.set('manager_uid', this.managerFilter);
    }
    if (this.searchTerm.trim()) {
      params = params.set('search', this.searchTerm.trim());
    }

    const url = `${environment.apiUrl}/admin/orders`;

    this.subscriptions.add(
      this.http.get<ApiResponse<AdminOrder[]>>(url, { params }).pipe(
        switchMap((response: ApiResponse<AdminOrder[]>) => {
          this.orders = response.data || [];
          this.total = response.pagination?.total ?? this.orders.length;
          this.totalPages = response.pagination?.total_pages ?? Math.ceil(this.total / this.pageSize);

          // Invoice/shipment marks are non-essential decoration, so they load
          // alongside the rest instead of gating the table on them.
          this.loadOrderMarks();

          const currencyCodes = [...new Set(this.orders.map(order => order.currency_code))];
          return this.currencyService.getCurrenciesByCodes(currencyCodes);
        }),
        switchMap((currencies) => {
          currencies.forEach(currency => {
            if (!this.currencies[currency.code]) {
              this.currencies[currency.code] = currency;
            }
          });

          // Fetch clients
          const clientUIDs = [...new Set(this.orders.map(order => order.client_uid))];

          if (clientUIDs.length > 0) {
            return this.http.post<ApiResponse<any[]>>(
              `${environment.apiUrl}/client/batch`,
              { data: clientUIDs }
            );
          }

          return of({ data: [] as any[] });
        })
      ).subscribe({
        next: (clientsResponse: any) => {
          if (clientsResponse.data) {
            clientsResponse.data.forEach((client: any) => {
              this.clients[client.uid] = client;
            });
          }

          this.filteredOrders = this.orders;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load orders:', err);
          this.error = 'Failed to load orders';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  /**
   * Loads the invoice/shipment marks for the orders currently on the page.
   * Failures are swallowed: the marks are supplementary, and an empty column is
   * better than an error banner over an otherwise usable list. A late response
   * for a page the user already left is dropped rather than painting the wrong
   * documents onto the rows now on screen.
   */
  private loadOrderMarks(): void {
    this.marks = {};
    const orderUids = this.orders.map(order => order.uid);
    if (orderUids.length === 0) {
      return;
    }

    const request = ++this.marksRequestId;
    this.subscriptions.add(
      this.http.post<ApiResponse<{ [orderUid: string]: OrderMarks }>>(
        `${environment.apiUrl}/admin/orders/marks`,
        { data: orderUids }
      ).subscribe({
        next: (response) => {
          if (request !== this.marksRequestId) {
            return;
          }
          this.marks = response.data || {};
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load order marks:', err);
        }
      })
    );
  }

  /** Invoice type names generated for an order, e.g. "Proforma, Faktura". */
  getInvoiceTypes(orderUid: string): string[] {
    return this.marks[orderUid]?.invoice_types ?? [];
  }

  hasShipment(orderUid: string): boolean {
    return this.marks[orderUid]?.has_shipment ?? false;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  /** Stage name in the current UI language, falling back to the base name. */
  private localizedStageName(stage: CrmStage): string {
    const lang = this.translationService.getCurrentLanguage();
    const match = (stage.translations || []).find(t => t.language === lang && !!t.name);
    return match?.name || stage.name;
  }

  getStoreName(uid: string): string {
    return this.stores[uid]?.name || uid;
  }

  getClientName(uid: string): string {
    return this.clients[uid]?.name || uid;
  }

  getCurrency(code: string): Currency | null {
    return this.currencies[code] || null;
  }

  onSearchChange(): void {
    this.searchInput$.next(this.searchTerm);
  }

  async deleteOrder(order: AdminOrder): Promise<void> {
    const confirmed = await this.confirmDialog.ask({
      message: `Are you sure you want to delete order "${order.number || order.uid}"?`,
      danger: true
    });
    if (!confirmed) {
      return;
    }

    this.subscriptions.add(
      this.http.post(`${environment.apiUrl}/admin/orders/delete`, {
        data: [order.uid]
      }).subscribe({
        next: () => {
          this.loadOrders();
        },
        error: (err) => {
          console.error('Failed to delete order:', err);
          this.notifications.error('Failed to delete order');
        }
      })
    );
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  /**
   * Colour configured for the CRM stage an order sits in, or null when the
   * status does not name a stage (drafts, or a stage that no longer exists).
   * Returning null leaves the status class to style the badge.
   */
  getStageColor(status: string): string | null {
    return this.stageColors[status] || null;
  }

  formatDate(dateString: string): string {
    return formatDateTime(dateString);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyFilters(false);
    }
  }

  /**
   * Opens an order, handing the detail page the URL to come back to so the
   * filters and page the user was on survive the round trip.
   */
  viewOrderDetail(order: AdminOrder): void {
    this.router.navigate(['/admin/orders', order.uid], {
      queryParams: { returnUrl: this.router.url }
    });
  }

  createOrder(): void {
    this.router.navigate(['/admin/orders/new']);
  }

}
