import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ContentLanguage } from '../../../core/models/content-page.model';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ContentPageService } from '../../../core/services/content-page.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { TranslationService } from '../../../core/services/translation.service';

/**
 * The hub's own language registry (admin-only).
 *
 * Deliberately not derived from product_descriptions the way /frontend/languages
 * is: the catalog and the hub grow different language sets, and a free-form code
 * would create phantom languages with nowhere to hang a display name.
 */
@Component({
  selector: 'app-content-languages',
  templateUrl: './languages.component.html',
  styleUrls: ['./languages.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentLanguagesComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  languages: ContentLanguage[] = [];
  loading = false;
  saving = false;
  error: string | null = null;

  newCode = '';
  newName = '';

  constructor(
    private pages: ContentPageService,
    private cdr: ChangeDetectorRef,
    private pageTitle: PageTitleService,
    private translation: TranslationService,
    private confirmDialog: ConfirmDialogService,
    private notifications: NotificationService
  ) {}

  ngOnInit(): void {
    this.pageTitle.setTitle(this.translation.instant('admin.contentLanguages.title'));
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.pages
      .listLanguagesAdmin()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: languages => {
          this.languages = languages;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to load content languages:', err);
          this.error = this.translation.instant('admin.contentLanguages.loadError');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  add(): void {
    const code = this.newCode.trim().toLowerCase();
    const name = this.newName.trim();

    if (!code || !name) {
      this.error = this.translation.instant('admin.contentLanguages.errCodeAndName');
      return;
    }
    if (this.languages.some(l => l.code === code)) {
      this.error = this.translation.instant('admin.contentLanguages.errDuplicate', { code });
      return;
    }

    this.error = null;
    this.languages = [
      ...this.languages,
      { code, name, sort_order: this.languages.length + 1, active: true }
    ];
    this.newCode = '';
    this.newName = '';
    this.save();
  }

  save(): void {
    this.saving = true;
    this.languages.forEach((l, i) => (l.sort_order = i + 1));

    this.pages
      .saveLanguages(this.languages)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving = false;
          this.notifications.success(this.translation.instant('admin.contentLanguages.saved'));
          this.load();
        },
        error: err => {
          this.saving = false;
          this.error =
            err?.error?.status_message ||
            this.translation.instant('admin.contentLanguages.saveError');
          this.cdr.markForCheck();
        }
      });
  }

  move(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this.languages.length) return;

    const next = [...this.languages];
    [next[index], next[target]] = [next[target], next[index]];
    this.languages = next;
    this.save();
  }

  /**
   * Deactivating hides a language from pickers and the client switcher without
   * touching any translation already written in it.
   */
  toggleActive(language: ContentLanguage): void {
    language.active = !language.active;
    this.save();
  }

  async remove(language: ContentLanguage): Promise<void> {
    const message = this.translation.instant('admin.contentLanguages.deleteConfirm', {
      name: language.name
    });
    if (!(await this.confirmDialog.ask({ message, danger: true }))) return;

    this.pages
      .deleteLanguages([language.code])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.load(),
        error: err => {
          console.error('Failed to delete language:', err);
          this.notifications.error(
            this.translation.instant('admin.contentLanguages.deleteError')
          );
        }
      });
  }

  trackByCode(_index: number, language: ContentLanguage): string {
    return language.code;
  }
}
