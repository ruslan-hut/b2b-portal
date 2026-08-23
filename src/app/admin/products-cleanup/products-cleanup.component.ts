import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageTitleService } from '../../core/services/page-title.service';
import { TranslationService } from '../../core/services/translation.service';
import { ApiResponse } from '../../core/models/api.model';

interface ProductCleanupCounts {
  products: number;
  prices: number;
  descriptions: number;
  images: number;
  tag_assignments: number;
  attributes: number;
  attribute_descriptions: number;
  store_inventory: number;
  discount_limits: number;
  categories: number;
  category_descriptions: number;
}

interface ProductCleanupItem {
  uid: string;
  sku: string;
}

interface ProductCleanupReport {
  counts: ProductCleanupCounts;
  // Full candidate UID set from analysis; echoed back on execute so deletion is bounded
  // to exactly what was previewed and confirmed.
  uids: string[];
  sample: ProductCleanupItem[];
  executed: boolean;
}

interface CountRow {
  labelKey: string;
  value: number;
}

type CleanupPhase = 'idle' | 'analyzing' | 'analyzed' | 'executing' | 'done';

@Component({
  selector: 'app-products-cleanup',
  templateUrl: './products-cleanup.component.html',
  styleUrl: './products-cleanup.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsCleanupComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private readonly apiUrl = environment.apiUrl;

  phase: CleanupPhase = 'idle';
  error: string | null = null;
  report: ProductCleanupReport | null = null;
  showConfirm = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService,
    private translation: TranslationService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle(this.translation.instant('admin.productsCleanup.title'));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get isBusy(): boolean {
    return this.phase === 'analyzing' || this.phase === 'executing';
  }

  // Go marshals empty slices as null; normalize so the template can safely read .length.
  private normalize(report: ProductCleanupReport): ProductCleanupReport {
    return { ...report, uids: report.uids ?? [], sample: report.sample ?? [] };
  }

  /** Linked-data row counts derived from the current report, for table rendering. */
  get linkedCounts(): CountRow[] {
    if (!this.report) {
      return [];
    }
    const c = this.report.counts;
    return [
      { labelKey: 'admin.productsCleanup.tables.prices', value: c.prices },
      { labelKey: 'admin.productsCleanup.tables.descriptions', value: c.descriptions },
      { labelKey: 'admin.productsCleanup.tables.images', value: c.images },
      { labelKey: 'admin.productsCleanup.tables.tags', value: c.tag_assignments },
      { labelKey: 'admin.productsCleanup.tables.attributes', value: c.attributes },
      { labelKey: 'admin.productsCleanup.tables.attributeDescriptions', value: c.attribute_descriptions },
      { labelKey: 'admin.productsCleanup.tables.inventory', value: c.store_inventory },
      { labelKey: 'admin.productsCleanup.tables.discountLimits', value: c.discount_limits },
      { labelKey: 'admin.productsCleanup.tables.categories', value: c.categories },
      { labelKey: 'admin.productsCleanup.tables.categoryDescriptions', value: c.category_descriptions }
    ];
  }

  // Phase 1: analysis (preview only, deletes nothing).
  analyze(): void {
    this.phase = 'analyzing';
    this.error = null;
    this.report = null;
    this.showConfirm = false;

    this.subscriptions.add(
      this.http.get<ApiResponse<ProductCleanupReport>>(`${this.apiUrl}/admin/products-cleanup/analyze`).subscribe({
        next: (response) => {
          this.report = this.normalize(response.data);
          this.phase = 'analyzed';
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = this.translation.instant('admin.productsCleanup.errAnalyze');
          this.phase = 'idle';
          this.cdr.detectChanges();
        }
      })
    );
  }

  openConfirm(): void {
    if (this.report && this.report.counts.products > 0) {
      this.showConfirm = true;
    }
  }

  cancelConfirm(): void {
    this.showConfirm = false;
  }

  // Phase 2: confirmed cleanup (permanent deletion). Sends back exactly the candidate set
  // resolved during analysis so the deletion is bounded to what was previewed and confirmed.
  execute(): void {
    this.showConfirm = false;
    this.phase = 'executing';
    this.error = null;

    const payload = { data: this.report?.uids ?? [] };
    this.subscriptions.add(
      this.http.post<ApiResponse<ProductCleanupReport>>(`${this.apiUrl}/admin/products-cleanup/execute`, payload).subscribe({
        next: (response) => {
          this.report = this.normalize(response.data);
          this.phase = 'done';
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = this.translation.instant('admin.productsCleanup.errExecute');
          this.phase = 'analyzed';
          this.cdr.detectChanges();
        }
      })
    );
  }

  reset(): void {
    this.phase = 'idle';
    this.report = null;
    this.error = null;
    this.showConfirm = false;
  }
}
