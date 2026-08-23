import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { ProductTag } from '../../../core/models/product-tag.model';
import { AuthService } from '../../../core/services/auth.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-tag-edit',
  templateUrl: './tag-edit.component.html',
  styleUrls: ['./tag-edit.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TagEditComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  uid: string | null = null;
  storeUid = '';
  loading = false;
  saving = false;
  error: string | null = null;

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private pageTitleService: PageTitleService,
    private translationService: TranslationService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(64)]],
      color: ['#6366F1', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
      // The API encodes "sorting disabled" as a negative sort_order. The form splits that
      // into a toggle plus a non-negative number so operators never type a magic -1.
      sorting_enabled: [true],
      sort_order: [0, [Validators.min(0)]]
    });
  }

  get sortingEnabled(): boolean {
    return this.form.value.sorting_enabled !== false;
  }

  get isNew(): boolean {
    return this.uid === null;
  }

  ngOnInit(): void {
    this.uid = this.route.snapshot.paramMap.get('uid');

    if (this.isNew) {
      this.pageTitleService.setTitle(this.translationService.instant('admin.tags.newTag'));
      const queryStore = this.route.snapshot.queryParamMap.get('store');
      const entity = this.authService.currentEntityValue as { store_uid?: string } | null;
      this.storeUid = queryStore || entity?.store_uid || '';
    } else {
      this.pageTitleService.setTitle(this.translationService.instant('admin.tags.editTag'));
      this.loadTag(this.uid!);
    }
  }

  loadTag(uid: string): void {
    this.loading = true;
    this.http.post<ApiResponse<ProductTag[]>>(`${environment.apiUrl}/admin/product_tags/batch`, { data: [uid] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const tag = response.data?.[0];
          if (!tag) {
            this.error = this.translationService.instant('admin.tags.notFound');
            this.loading = false;
            this.cdr.markForCheck();
            return;
          }
          this.storeUid = tag.store_uid;
          const sortingEnabled = tag.sort_order >= 0;
          this.form.patchValue({
            name: tag.name,
            color: tag.color,
            sorting_enabled: sortingEnabled,
            sort_order: sortingEnabled ? tag.sort_order : 0
          });
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load tag:', err);
          this.error = this.translationService.instant('admin.tags.loadError');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  save(): void {
    if (this.form.invalid || !this.storeUid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const tag: ProductTag = {
      uid: this.uid ?? '',
      store_uid: this.storeUid,
      name: this.form.value.name,
      color: (this.form.value.color as string).toUpperCase(),
      sort_order: this.sortingEnabled ? Math.max(0, Number(this.form.value.sort_order ?? 0)) : -1
    };

    this.http.post<ApiResponse<string[]>>(`${environment.apiUrl}/admin/product_tags`, { data: [tag] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving = false;
          this.router.navigate(['/admin/tags']);
        },
        error: (err) => {
          console.error('Failed to save tag:', err);
          this.error = this.translationService.instant('admin.tags.saveError');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  cancel(): void {
    this.router.navigate(['/admin/tags']);
  }

  textColorFor(hex: string): string {
    const c = (hex || '').replace('#', '');
    if (c.length !== 3 && c.length !== 6) return '#fff';
    const full = c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.6 ? '#1a1a1a' : '#ffffff';
  }
}
