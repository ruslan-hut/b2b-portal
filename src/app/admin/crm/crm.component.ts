import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CrmService } from './services/crm.service';
import { CrmPollingService } from './services/crm-polling.service';
import { InvoiceService } from '../../core/services/invoice.service';
import { formatDateShort } from '../../core/utils/date-format';
import { CrmBoardResponse, CrmBoardColumn, CrmBoardOrder } from './models/crm-board.model';
import { CrmTransition } from './models/crm-stage.model';
import { StoreService } from '../../core/services/store.service';
import { Store } from '../../core/models/store.model';
import { PageTitleService } from '../../core/services/page-title.service';
import { PriceFormattingService } from '../../core/services/price-formatting.service';
import { CrmDashboardFilters } from './models/crm-dashboard.model';
import { CrmFiltersEmit } from './components/dashboard-filters/dashboard-filters.component';
import { CrmFiltersStateService } from './services/crm-filters-state.service';

interface OrderSnapshot {
  total: number;
  status: string;
  stageUid: string;
}

@Component({
    selector: 'app-crm',
    templateUrl: './crm.component.html',
    styleUrls: ['./crm.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CrmComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  rawBoard: CrmBoardResponse = { columns: [] };
  board: CrmBoardResponse = { columns: [] };
  transitions: CrmTransition[] = [];
  stores: { [uid: string]: Store } = {};
  loading = false;
  error: string | null = null;

  filters: CrmDashboardFilters = {};
  ordersPerStage: number = 50;
  isFiltersExpanded = false;
  searchQuery = '';
  // Same scope as the filters panel below, so search and filters persist together.
  private readonly filtersScope = 'kanban';

  showAssignmentModal = false;
  selectedOrder: CrmBoardOrder | null = null;

  showOrderDetailsPanel = false;
  selectedOrderForDetails: CrmBoardOrder | null = null;

  // Fulfilment indicators for the selected order (side panel).
  // One badge per distinct invoice type with a successful invoice; name is null
  // when the type can no longer be resolved (e.g. deleted) → generic label.
  orderInvoiceBadges: { uid: string; name: string | null }[] = [];
  orderHasShipment = false;
  indicatorsLoading = false;

  changedOrderUids: Set<string> = new Set();
  private previousOrderSnapshots: Map<string, OrderSnapshot> = new Map();

  constructor(
    private crmService: CrmService,
    private pollingService: CrmPollingService,
    private storeService: StoreService,
    public router: Router,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService,
    private priceFormatting: PriceFormattingService,
    private invoiceService: InvoiceService,
    private filtersState: CrmFiltersStateService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('CRM Pipeline');
    this.searchQuery = this.filtersState.loadSearch(this.filtersScope);
    this.loadInitialData();
    this.startChangePolling();
  }

  private startChangePolling(): void {
    this.pollingService.startPolling(this.filters.storeUid || undefined);
    this.subscriptions.add(
      this.pollingService.changes$.subscribe(changes => {
        if (changes.has_changes && !this.showAssignmentModal) {
          this.loadBoard();
          this.pollingService.resetLastChecked();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.pollingService.stopPolling();
    this.subscriptions.unsubscribe();
  }

  loadInitialData(): void {
    this.loading = true;
    this.subscriptions.add(
      forkJoin({
        stores: this.storeService.getStores(),
        transitions: this.crmService.getTransitions()
      }).subscribe({
        next: ({ stores, transitions }) => {
          this.stores = stores;
          this.transitions = transitions;
          this.loadBoard();
        },
        error: (err) => {
          console.error('Failed to load initial data:', err);
          this.error = 'Failed to load initial data';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  loadBoard(): void {
    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.crmService.getBoard(this.filters.storeUid || undefined, this.ordersPerStage).subscribe({
        next: (board) => {
          this.detectChangedOrders(board);
          this.rawBoard = board;
          this.applyClientFilters();
          this.snapshotOrders(this.board);
          this.refreshSelectedOrder();
          this.loading = false;
          this.cdr.detectChanges();

          if (this.changedOrderUids.size > 0) {
            setTimeout(() => {
              this.changedOrderUids = new Set();
              this.cdr.detectChanges();
            }, 2000);
          }
        },
        error: (err) => {
          console.error('Failed to load CRM board:', err);
          this.error = 'Failed to load CRM board';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  private applyClientFilters(): void {
    const assignee = this.filters.assigneeUid || '';
    const fromTs = this.filters.dateFrom ? new Date(this.filters.dateFrom).getTime() : undefined;
    const toTs = this.filters.dateTo ? new Date(this.filters.dateTo).getTime() : undefined;
    const query = this.searchQuery.trim().toLowerCase();

    if (!assignee && fromTs === undefined && toTs === undefined && !query) {
      this.board = this.rawBoard;
      return;
    }

    this.board = {
      columns: this.rawBoard.columns.map(col => ({
        ...col,
        orders: col.orders.filter(o => {
          if (assignee && o.assigned_user_uid !== assignee) return false;
          if (query &&
              !(o.number || '').toLowerCase().includes(query) &&
              !(o.client_name || '').toLowerCase().includes(query)) {
            return false;
          }
          if (fromTs !== undefined || toTs !== undefined) {
            // Period filter uses the order's modification date, not creation date.
            const dateRef = o.last_update || o.created_at;
            const t = dateRef ? new Date(dateRef).getTime() : NaN;
            if (!isFinite(t)) return false;
            if (fromTs !== undefined && t < fromTs) return false;
            if (toTs !== undefined && t > toTs) return false;
          }
          return true;
        })
      }))
    };
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.filtersState.saveSearch(this.filtersScope, value);
    this.applyClientFilters();
    this.cdr.detectChanges();
  }

  private snapshotOrders(board: CrmBoardResponse): void {
    this.previousOrderSnapshots.clear();
    for (const column of board.columns) {
      for (const order of column.orders) {
        this.previousOrderSnapshots.set(order.uid, {
          total: order.total,
          status: order.status,
          stageUid: column.stage.uid
        });
      }
    }
  }

  private refreshSelectedOrder(): void {
    if (!this.selectedOrderForDetails) return;
    const uid = this.selectedOrderForDetails.uid;
    for (const column of this.board.columns) {
      const found = column.orders.find(o => o.uid === uid);
      if (found) {
        this.selectedOrderForDetails = found;
        return;
      }
    }
  }

  private detectChangedOrders(newBoard: CrmBoardResponse): void {
    if (this.previousOrderSnapshots.size === 0) return;
    const changed = new Set<string>();
    for (const column of newBoard.columns) {
      for (const order of column.orders) {
        const prev = this.previousOrderSnapshots.get(order.uid);
        if (!prev) continue;
        if (prev.stageUid === column.stage.uid &&
            (prev.total !== order.total || prev.status !== order.status)) {
          changed.add(order.uid);
        }
      }
    }
    this.changedOrderUids = changed;
  }

  onFiltersChange(event: CrmFiltersEmit): void {
    const prevStore = this.filters.storeUid;
    this.filters = event.filters;
    if (prevStore !== this.filters.storeUid) {
      this.pollingService.stopPolling();
      this.pollingService.startPolling(this.filters.storeUid || undefined);
      this.loadBoard();
    } else {
      // Server data unchanged; just re-apply client filters.
      this.applyClientFilters();
      this.cdr.detectChanges();
    }
  }

  toggleFilters(): void {
    this.isFiltersExpanded = !this.isFiltersExpanded;
    this.cdr.markForCheck();
  }

  onOrderMoved(event: { orderUid: string; fromStageUid: string; toStageUid: string }): void {
    this.subscriptions.add(
      this.crmService.moveOrder(event.orderUid, event.toStageUid, true).subscribe({
        next: () => this.cdr.detectChanges(),
        error: (err) => {
          console.error('Failed to move order:', err);
          this.loadBoard();
        }
      })
    );
  }

  onAssignOrder(order: CrmBoardOrder): void {
    this.selectedOrder = order;
    this.showAssignmentModal = true;
    this.cdr.detectChanges();
  }

  onAssignmentComplete(): void {
    this.showAssignmentModal = false;
    this.selectedOrder = null;
    this.loadBoard();
  }

  onAssignmentCancel(): void {
    this.showAssignmentModal = false;
    this.selectedOrder = null;
    this.cdr.detectChanges();
  }

  canMoveToStage(fromStageUid: string, toStageUid: string): boolean {
    if (fromStageUid === toStageUid) return false;
    return this.transitions.some(t =>
      t.from_stage_uid === fromStageUid && t.to_stage_uid === toStageUid
    );
  }

  getStoreName(uid: string): string {
    return this.stores[uid]?.name || uid;
  }

  viewOrder(order: CrmBoardOrder): void {
    this.selectedOrderForDetails = order;
    this.showOrderDetailsPanel = true;
    this.loadOrderIndicators(order.uid);
    this.cdr.detectChanges();
  }

  closeOrderDetailsPanel(): void {
    this.showOrderDetailsPanel = false;
    this.selectedOrderForDetails = null;
    this.orderInvoiceBadges = [];
    this.orderHasShipment = false;
    this.indicatorsLoading = false;
    this.cdr.detectChanges();
  }

  // Loads the invoice types with a successful invoice and whether a shipment
  // exists, to drive the fulfilment indicators shown in the side panel.
  private loadOrderIndicators(uid: string): void {
    this.orderInvoiceBadges = [];
    this.orderHasShipment = false;
    this.indicatorsLoading = true;

    this.subscriptions.add(
      forkJoin({
        invoices: this.invoiceService.getInvoicesForOrders([uid]),
        shipments: this.http.post<{ data: Array<unknown> }>(
          `${environment.apiUrl}/admin/orders/shipment/list`,
          { data: { order_uid: uid } }
        )
      }).pipe(
        switchMap(({ invoices, shipments }) => {
          const hasShipment = (shipments?.data || []).length > 0;
          const successful = invoices.filter(
            inv => !inv.error && inv.status_code >= 200 && inv.status_code < 300
          );
          const typeUids = [...new Set(successful.map(inv => inv.type_uid))];
          if (typeUids.length === 0) {
            return of({ badges: [] as { uid: string; name: string | null }[], hasShipment });
          }
          // Resolve type UIDs to display names (a distinct badge per type).
          // Unresolved UIDs (e.g. deleted type) keep name=null → generic label.
          return this.invoiceService.getTypesByUIDs(typeUids).pipe(
            map(types => {
              const nameByUid = new Map(types.map(t => [t.uid, t.name]));
              return { badges: typeUids.map(u => ({ uid: u, name: nameByUid.get(u) ?? null })), hasShipment };
            }),
            catchError(() => of({ badges: typeUids.map(u => ({ uid: u, name: null })), hasShipment }))
          );
        })
      ).subscribe({
        next: ({ badges, hasShipment }) => {
          // Guard against a stale response after the user switched orders.
          if (this.selectedOrderForDetails?.uid !== uid) return;
          this.orderInvoiceBadges = badges;
          this.orderHasShipment = hasShipment;
          this.indicatorsLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          if (this.selectedOrderForDetails?.uid !== uid) return;
          this.indicatorsLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  navigateToOrderDetails(): void {
    if (this.selectedOrderForDetails) {
      this.router.navigate(['/admin/orders', this.selectedOrderForDetails.uid], { queryParams: { from: 'crm' } });
    }
  }

  navigateToOrderPage(order: CrmBoardOrder): void {
    this.router.navigate(['/admin/orders', order.uid], { queryParams: { from: 'crm' } });
  }

  formatPrice(amount: number, currencyCode: string): string {
    return this.priceFormatting.formatPriceWithCurrency(amount, currencyCode);
  }

  formatDate(dateString: string): string {
    return formatDateShort(dateString);
  }
}
