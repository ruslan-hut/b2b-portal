import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api.model';
import { ProductTag } from '../../core/models/product-tag.model';
import { AuthService } from '../../core/services/auth.service';
import { PageTitleService } from '../../core/services/page-title.service';
import { TranslationService } from '../../core/services/translation.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { NotificationService } from '../../core/services/notification.service';

interface AdminStore {
  uid: string;
  name: string;
}

@Component({
  selector: 'app-tags',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TagsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  tags: ProductTag[] = [];
  stores: AdminStore[] = [];
  selectedStore = '';
  // True when a store-scoped manager is logged in: store filter is locked.
  storeLocked = false;

  loading = false;
  error: string | null = null;

  currentPage = 1;
  pageSize = 50;
  total = 0;
  totalPages = 1;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private pageTitleService: PageTitleService,
    private translationService: TranslationService,
    private confirmDialog: ConfirmDialogService,
    private notifications: NotificationService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle(this.translationService.instant('admin.tags.title'));
    // Default the store filter to the current user's store; admins can switch.
    const entity = this.authService.currentEntityValue as { store_uid?: string } | null;
    this.selectedStore = entity?.store_uid ?? '';
    // Store-scoped managers cannot switch stores.
    this.storeLocked = this.authService.isStoreScopedManager();
    this.loadStores();
    if (this.selectedStore) {
      this.loadTags();
    }
  }

  loadStores(): void {
    this.http.get<ApiResponse<AdminStore[]>>(`${environment.apiUrl}/store`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.stores = response.data || [];
          if (!this.selectedStore && this.stores.length === 1) {
            this.selectedStore = this.stores[0].uid;
            this.loadTags();
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load stores:', err);
          this.error = this.translationService.instant('admin.tags.loadError');
          this.cdr.markForCheck();
        }
      });
  }

  // Pick black or white for readable contrast on the tag background.
  textColorFor(hex: string): string {
    const c = (hex || '').replace('#', '');
    if (c.length !== 3 && c.length !== 6) return '#fff';
    const full = c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    // Relative luminance (sRGB)
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.6 ? '#1a1a1a' : '#ffffff';
  }

  loadTags(): void {
    if (!this.selectedStore) {
      this.tags = [];
      this.total = 0;
      this.totalPages = 1;
      return;
    }
    this.loading = true;
    this.error = null;

    const url = `${environment.apiUrl}/admin/product_tags?store_uid=${encodeURIComponent(this.selectedStore)}&page=${this.currentPage}&count=${this.pageSize}`;

    this.http.get<ApiResponse<ProductTag[]>>(url)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.tags = response.data || [];
          if (response.pagination) {
            this.total = response.pagination.total || 0;
            this.totalPages = response.pagination.total_pages || Math.ceil(this.total / this.pageSize);
          } else {
            this.total = this.tags.length;
            this.totalPages = 1;
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load product tags:', err);
          this.error = this.translationService.instant('admin.tags.loadError');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onStoreChange(): void {
    this.currentPage = 1;
    this.loadTags();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadTags();
  }

  createTag(): void {
    this.router.navigate(['/admin/tags/new'], { queryParams: { store: this.selectedStore } });
  }

  editTag(tag: ProductTag): void {
    this.router.navigate(['/admin/tags', tag.uid]);
  }

  async deleteTag(tag: ProductTag): Promise<void> {
    const msg = this.translationService.instant('admin.tags.deleteConfirm', { name: tag.name });
    if (!await this.confirmDialog.ask({ message: msg, danger: true })) return;

    this.http.post(`${environment.apiUrl}/admin/product_tags/delete`, { data: [tag.uid] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadTags(),
        error: (err) => {
          console.error('Failed to delete tag:', err);
          this.notifications.error(this.translationService.instant('admin.tags.deleteError'));
        }
      });
  }
}
