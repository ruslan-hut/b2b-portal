import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { CrmService } from './services/crm.service';
import { CrmBoardResponse, CrmBoardColumn, CrmBoardOrder } from './models/crm-board.model';
import { CrmStage, CrmTransition } from './models/crm-stage.model';
import { StoreService } from '../../core/services/store.service';
import { Store } from '../../core/models/store.model';

@Component({
    selector: 'app-crm',
    templateUrl: './crm.component.html',
    styleUrls: ['./crm.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CrmComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  board: CrmBoardResponse = { columns: [] };
  transitions: CrmTransition[] = [];
  stores: { [uid: string]: Store } = {};
  loading = false;
  error: string | null = null;

  // Filters
  selectedStoreUid: string = '';
  ordersPerStage: number = 50;
  storeOptions: { value: string; label: string }[] = [];

  // Assignment modal
  showAssignmentModal = false;
  selectedOrder: CrmBoardOrder | null = null;

  // Order details panel
  showOrderDetailsPanel = false;
  selectedOrderForDetails: CrmBoardOrder | null = null;

  constructor(
    private crmService: CrmService,
    private storeService: StoreService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  ngOnDestroy(): void {
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

          this.storeOptions = [
            { value: '', label: 'All Stores' },
            ...Object.values(stores).map(s => ({
              value: s.uid,
              label: s.name
            })).sort((a, b) => a.label.localeCompare(b.label))
          ];

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
      this.crmService.getBoard(this.selectedStoreUid || undefined, this.ordersPerStage).subscribe({
        next: (board) => {
          this.board = board;
          this.loading = false;
          this.cdr.detectChanges();
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

  onStoreChange(): void {
    this.loadBoard();
  }

  onOrderMoved(event: { orderUid: string; fromStageUid: string; toStageUid: string }): void {
    this.subscriptions.add(
      this.crmService.moveOrder(event.orderUid, event.toStageUid, true).subscribe({
        next: () => {
          // Move was successful, board is already updated optimistically
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to move order:', err);
          // Revert optimistic update by reloading
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
    if (fromStageUid === toStageUid) {
      return false;
    }
    return this.transitions.some(t =>
      t.from_stage_uid === fromStageUid && t.to_stage_uid === toStageUid
    );
  }

  getStoreName(uid: string): string {
    return this.stores[uid]?.name || uid;
  }

  goToSettings(): void {
    this.router.navigate(['/admin/crm/settings']);
  }

  goToMyTasks(): void {
    this.router.navigate(['/admin/crm/my-tasks']);
  }

  viewOrder(order: CrmBoardOrder): void {
    this.selectedOrderForDetails = order;
    this.showOrderDetailsPanel = true;
    this.cdr.detectChanges();
  }

  closeOrderDetailsPanel(): void {
    this.showOrderDetailsPanel = false;
    this.selectedOrderForDetails = null;
    this.cdr.detectChanges();
  }

  navigateToOrderDetails(): void {
    if (this.selectedOrderForDetails) {
      this.router.navigate(['/admin/orders', this.selectedOrderForDetails.uid]);
    }
  }

  navigateToOrderPage(order: CrmBoardOrder): void {
    this.router.navigate(['/admin/orders', order.uid]);
  }

  formatPrice(amount: number, currencyCode: string): string {
    return (amount / 100).toLocaleString(undefined, {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: 2
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

}
