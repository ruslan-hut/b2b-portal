import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SharedModule } from '../../../shared/shared.module';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { formatCents } from '../../../core/utils/money-format';
import {
  OrderSplitBranchOption,
  OrderSplitMode,
  OrderSplitOptions,
  OrderSplitPartAssignment,
  OrderSplitPreview,
  OrderSplitRequest
} from '../models/order-split.model';

/**
 * The company and payer chosen for one part, as the dialog holds it while the
 * operator works. `undefined` means "inherit from the source order" and is not
 * sent; `''` means "clear it" / "bill the client directly" and is.
 */
interface PartChoice {
  companyUid?: string;
  branchUid?: string;
}

/**
 * Splits one order into several. The manager picks either a number of equal
 * parts or a per-part amount limit; the backend plans the division, keeping each
 * product's line inside a single part where it can, and reports what the parts
 * would look like before anything is written.
 *
 * Once a plan exists, each part can be pointed at its own selling company and
 * its own billed party. That is the reason to split at invoicing time at all —
 * the goods are already agreed, and what needs correcting is who invoices whom.
 *
 * Two things the dialog will not let happen, both enforced again on the server:
 * it never computes money itself (every amount shown comes from the preview),
 * and it only offers payers that leave the order's VAT rate untouched. A party
 * that would change the rate is listed but unselectable, with its rate shown, so
 * an operator can see why rather than wondering where the branch went.
 */
@Component({
  selector: 'app-order-split-dialog',
  templateUrl: './order-split-dialog.html',
  styleUrl: './order-split-dialog.scss',
  imports: [FormsModule, SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderSplitDialog implements OnInit {
  private readonly http = inject(HttpClient);

  readonly orderUid = input.required<string>();
  readonly orderNumber = input<string>('');
  /** Order gross total in cents, as the detail page shows it. */
  readonly orderTotal = input<number>(0);

  readonly closed = output<void>();
  /** Emitted with the created parts once the split has been performed. */
  readonly split = output<OrderSplitPreview>();

  readonly mode = signal<OrderSplitMode>('parts');
  readonly parts = signal(2);
  /** Per-part limit in display units — converted to cents on the wire. */
  readonly limit = signal<number | null>(null);
  readonly tolerance = signal(10);

  readonly preview = signal<OrderSplitPreview | null>(null);
  readonly previewing = signal(false);
  readonly splitting = signal(false);
  readonly error = signal<string | null>(null);

  /** Company and payer options for this order, loaded once when the dialog opens. */
  readonly options = signal<OrderSplitOptions | null>(null);
  /** Per-part choices, keyed by 1-based part index. */
  readonly choices = signal<Record<number, PartChoice>>({});

  /** Only a VAT-neutral, active party may actually be picked. */
  readonly payerOptions = computed(() => this.options()?.branches ?? []);
  readonly companyOptions = computed(() => this.options()?.companies ?? []);

  ngOnInit(): void {
    this.loadOptions();
  }

  private loadOptions(): void {
    this.http.post<ApiResponse<OrderSplitOptions>>(
      `${environment.apiUrl}/admin/orders/split/options`,
      { order_uid: this.orderUid() }
    ).subscribe({
      // Options are an enhancement, not a precondition: if they fail to load the
      // dialog still splits, every part simply inheriting the order's identity.
      next: resp => this.options.set(resp.data ?? null),
      error: () => this.options.set(null)
    });
  }

  selectable(option: OrderSplitBranchOption): boolean {
    return option.vat_neutral && option.active;
  }

  choiceFor(index: number): PartChoice {
    return this.choices()[index] ?? {};
  }

  /** '' is a real value here (bill the client / clear the company), so the
   *  inherit case is represented by the sentinel below rather than by ''. */
  readonly inherit = '__inherit__';

  companyValue(index: number): string {
    const chosen = this.choiceFor(index).companyUid;
    return chosen === undefined ? this.inherit : chosen;
  }

  branchValue(index: number): string {
    const chosen = this.choiceFor(index).branchUid;
    return chosen === undefined ? this.inherit : chosen;
  }

  setCompany(index: number, value: string): void {
    this.updateChoice(index, { companyUid: value === this.inherit ? undefined : value });
  }

  setBranch(index: number, value: string): void {
    this.updateChoice(index, { branchUid: value === this.inherit ? undefined : value });
  }

  private updateChoice(index: number, patch: PartChoice): void {
    this.choices.update(current => ({
      ...current,
      [index]: { ...(current[index] ?? {}), ...patch }
    }));
    // Refresh in place rather than clearing. The selectors live inside the parts
    // list, so dropping the preview would unmount the control the operator just
    // used and force a Calculate between every choice. An assignment does not
    // change the plan either — the same goods land in the same parts — so only
    // the resolved company, payer and warnings need to come back.
    this.refreshPreview();
  }

  readonly canPreview = computed(() => {
    if (this.previewing() || this.splitting()) return false;
    return this.mode() === 'parts'
      ? this.parts() >= 2
      : (this.limit() ?? 0) > 0;
  });

  // A standing error means the last resolve was rejected — most often a payer
  // that would move the VAT rate. The shown plan is then not what would be
  // written, so committing it is not offered until the choice is corrected.
  readonly canSplit = computed(() =>
    !!this.preview() && !this.error() && !this.splitting() && !this.previewing()
  );

  format(cents: number): string {
    return formatCents(cents);
  }

  setMode(mode: OrderSplitMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.invalidatePreview();
  }

  /**
   * Any change to the parameters makes the shown preview stale. Part choices go
   * with it: they are keyed by part index, and a different part count means the
   * indexes no longer refer to the same goods.
   */
  invalidatePreview(): void {
    this.preview.set(null);
    this.choices.set({});
    this.error.set(null);
  }

  onClose(): void {
    if (this.splitting()) return;
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.onClose();
  }

  loadPreview(): void {
    if (!this.canPreview()) return;
    // A first plan: there is nothing to keep if it fails.
    this.fetchPreview(true);
  }

  /**
   * Re-resolves the shown plan after an assignment changed. Keeps the current
   * preview on failure so the rejected choice can be corrected in place — a
   * payer that would move the VAT rate is refused by the server, and the
   * operator needs the list still on screen to pick another.
   */
  private refreshPreview(): void {
    if (!this.preview() || this.splitting()) return;
    this.fetchPreview(false);
  }

  private fetchPreview(clearOnError: boolean): void {
    this.previewing.set(true);
    this.error.set(null);

    this.http.post<ApiResponse<OrderSplitPreview>>(
      `${environment.apiUrl}/admin/orders/split/preview`,
      this.buildRequest()
    ).subscribe({
      next: resp => {
        this.preview.set(resp.data ?? null);
        this.previewing.set(false);
      },
      error: err => {
        if (clearOnError) {
          this.preview.set(null);
        }
        this.error.set(this.messageOf(err));
        this.previewing.set(false);
      }
    });
  }

  confirmSplit(): void {
    if (!this.canSplit()) return;

    this.splitting.set(true);
    this.error.set(null);

    this.http.post<ApiResponse<OrderSplitPreview>>(
      `${environment.apiUrl}/admin/orders/split`,
      this.buildRequest()
    ).subscribe({
      next: resp => {
        this.splitting.set(false);
        if (resp.data) {
          this.split.emit(resp.data);
        }
      },
      error: err => {
        this.error.set(this.messageOf(err));
        this.splitting.set(false);
      }
    });
  }

  private buildRequest(): OrderSplitRequest {
    const req: OrderSplitRequest = {
      order_uid: this.orderUid(),
      mode: this.mode(),
      tolerance_percent: this.tolerance()
    };
    if (this.mode() === 'parts') {
      req.parts = this.parts();
    } else {
      req.limit = Math.round((this.limit() ?? 0) * 100);
    }

    const assignments = this.buildAssignments();
    if (assignments.length) {
      req.assignments = assignments;
    }
    return req;
  }

  /** Only parts the operator actually touched are sent; the rest inherit. */
  private buildAssignments(): OrderSplitPartAssignment[] {
    const assignments: OrderSplitPartAssignment[] = [];
    for (const [key, choice] of Object.entries(this.choices())) {
      if (choice.companyUid === undefined && choice.branchUid === undefined) continue;
      const assignment: OrderSplitPartAssignment = { index: Number(key) };
      if (choice.companyUid !== undefined) assignment.company_uid = choice.companyUid;
      if (choice.branchUid !== undefined) assignment.branch_uid = choice.branchUid;
      assignments.push(assignment);
    }
    return assignments;
  }

  /** Translation key for a warning slug the backend returned. */
  warningKey(slug: string): string {
    return `admin.orders.splitWarning.${slug}`;
  }

  private messageOf(err: unknown): string {
    const body = (err as { error?: { message?: string; error?: string } })?.error;
    return body?.message || body?.error || 'error';
  }
}
