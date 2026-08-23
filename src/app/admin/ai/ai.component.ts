import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AIGlossaryTerm, AISettings, AISettingsUpdate, AITestResult, AIUsageSummary } from '../../core/models/ai.model';
import { AIService } from '../../core/services/ai.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ContentPageService } from '../../core/services/content-page.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageTitleService } from '../../core/services/page-title.service';
import { TranslationService } from '../../core/services/translation.service';

/**
 * Settings for the content editor's AI assistant (admin only).
 *
 * Three things on one screen because they are one decision: whether the
 * assistant runs, what it must never mistranslate, and what it has cost. The
 * glossary in particular is not an appendix — it is what makes translation
 * usable on regulatory material rather than merely possible.
 */
@Component({
  selector: 'app-ai-settings',
  templateUrl: './ai.component.html',
  styleUrls: ['./ai.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AISettingsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  settings: AISettings | null = null;
  glossary: AIGlossaryTerm[] = [];
  usage: AIUsageSummary[] = [];
  languages: string[] = [];

  loading = false;
  saving = false;
  testing = false;
  error: string | null = null;
  testResult: AITestResult | null = null;

  /**
   * The key field is only rendered while replacing. An empty input must never
   * be sent as an empty string — that clears a working key on an ordinary save.
   */
  replacingKey = false;
  newApiKey = '';

  newTerm: AIGlossaryTerm = { term: '', language: '', translation: '', do_not_translate: true, notes: '' };

  /**
   * Bulk paste.
   *
   * The seed set is ~55 rows and arrives as tables (see
   * docs/development/partners-hub-glossary-seed.md). Typing them one at a time
   * is the kind of chore that ends with half the glossary never being entered.
   */
  showPaste = false;
  pasteSource = '';
  pastePreview: AIGlossaryTerm[] = [];
  pasteParsed = false;

  constructor(
    private ai: AIService,
    private pages: ContentPageService,
    private cdr: ChangeDetectorRef,
    private pageTitle: PageTitleService,
    private translation: TranslationService,
    private confirmDialog: ConfirmDialogService,
    private notifications: NotificationService
  ) {}

  ngOnInit(): void {
    this.pageTitle.setTitle(this.translation.instant('admin.ai.title'));
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.ai
      .getSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: settings => {
          this.settings = settings;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to load AI settings:', err);
          this.error = this.translation.instant('admin.ai.loadError');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });

    this.loadGlossary();

    this.ai
      .getUsage(30)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: usage => {
          this.usage = usage;
          this.cdr.markForCheck();
        },
        // Usage is reporting, not configuration: failing to load it must not
        // stop an admin from fixing a key.
        error: () => undefined
      });

    this.pages
      .listLanguagesAdmin()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: languages => {
          this.languages = languages.map(l => l.code);
          this.cdr.markForCheck();
        },
        error: () => undefined
      });
  }

  private loadGlossary(): void {
    this.ai
      .listGlossary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: terms => {
          this.glossary = terms;
          this.cdr.markForCheck();
        },
        error: () => undefined
      });
  }

  // --- settings --------------------------------------------------------------

  get statusLabel(): string {
    if (!this.settings) {
      return '';
    }
    if (!this.settings.has_api_key) {
      return this.translation.instant('admin.ai.statusNoKey');
    }
    if (!this.settings.enabled) {
      return this.translation.instant('admin.ai.statusDisabled');
    }
    return this.translation.instant('admin.ai.statusReady');
  }

  get statusState(): 'ready' | 'off' | 'missing' {
    if (!this.settings?.has_api_key) {
      return 'missing';
    }
    return this.settings.enabled ? 'ready' : 'off';
  }

  get usedTokens(): number {
    return this.usage.reduce((sum, row) => sum + row.total_tokens, 0);
  }

  get capPercent(): number {
    const cap = this.settings?.monthly_token_cap || 0;
    if (cap <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((this.usedTokens / cap) * 100));
  }

  save(update: AISettingsUpdate): void {
    this.saving = true;
    this.error = null;

    this.ai
      .updateSettings(update)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: settings => {
          this.settings = settings;
          this.saving = false;
          this.replacingKey = false;
          this.newApiKey = '';
          this.notifications.success(this.translation.instant('admin.ai.saved'));
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to save AI settings:', err);
          this.error = this.translation.instant('admin.ai.saveError');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  toggleEnabled(): void {
    if (!this.settings) {
      return;
    }
    this.save({ enabled: !this.settings.enabled });
  }

  changeModel(model: string): void {
    this.save({ model });
  }

  saveCap(value: string): void {
    const cap = Math.max(0, parseInt(value, 10) || 0);
    this.save({ monthly_token_cap: cap });
  }

  saveApiKey(): void {
    const key = this.newApiKey.trim();
    if (!key) {
      return;
    }
    this.save({ api_key: key });
  }

  clearApiKey(): void {
    this.confirmDialog
      .ask({
        title: this.translation.instant('admin.ai.clearKeyTitle'),
        message: this.translation.instant('admin.ai.clearKeyMessage'),
        confirmLabel: this.translation.instant('common.delete'),
        danger: true
      })
      .then(confirmed => {
        if (confirmed) {
          this.save({ api_key: '' });
        }
      });
  }

  test(): void {
    this.testing = true;
    this.testResult = null;

    this.ai
      .testConnection()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.testResult = result;
          this.testing = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('AI connection test failed:', err);
          this.testResult = { ok: false, message: this.translation.instant('admin.ai.testFailed') };
          this.testing = false;
          this.cdr.markForCheck();
        }
      });
  }

  // --- glossary --------------------------------------------------------------

  addTerm(): void {
    const term = this.newTerm.term.trim();
    if (!term) {
      return;
    }
    if (!this.newTerm.do_not_translate && !this.newTerm.translation?.trim()) {
      this.error = this.translation.instant('admin.ai.errTermNeedsRule');
      return;
    }

    this.saveTerms([{ ...this.newTerm, term }]);
    this.newTerm = { term: '', language: '', translation: '', do_not_translate: true, notes: '' };
  }

  saveTerm(term: AIGlossaryTerm): void {
    if (!term.term.trim()) {
      return;
    }
    this.saveTerms([term]);
  }

  private saveTerms(terms: AIGlossaryTerm[]): void {
    this.saving = true;
    this.error = null;

    this.ai
      .saveGlossary(terms)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving = false;
          this.loadGlossary();
        },
        error: err => {
          console.error('Failed to save glossary:', err);
          this.error = this.translation.instant('admin.ai.glossarySaveError');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  removeTerm(term: AIGlossaryTerm): void {
    if (!term.uid) {
      return;
    }

    this.confirmDialog
      .ask({
        title: this.translation.instant('admin.ai.removeTermTitle'),
        message: this.translation.instant('admin.ai.removeTermMessage', { term: term.term }),
        confirmLabel: this.translation.instant('common.delete'),
        danger: true
      })
      .then(confirmed => {
        if (!confirmed) {
          return;
        }
        this.ai
          .deleteGlossary([term.uid!])
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => this.loadGlossary(),
            error: () => {
              this.error = this.translation.instant('admin.ai.glossarySaveError');
              this.cdr.markForCheck();
            }
          });
      });
  }

  /** A do-not-translate row cannot also pin a translation — the prompt would
   * carry two contradictory instructions for one term. */
  onRuleChange(term: AIGlossaryTerm): void {
    if (term.do_not_translate) {
      term.translation = '';
      term.language = '';
    }
    this.saveTerm(term);
  }

  // --- bulk paste -----------------------------------------------------------

  togglePaste(): void {
    this.showPaste = !this.showPaste;
    if (!this.showPaste) {
      this.resetPaste();
    }
    this.cdr.markForCheck();
  }

  private resetPaste(): void {
    this.pasteSource = '';
    this.pastePreview = [];
    this.pasteParsed = false;
  }

  previewPaste(): void {
    this.error = null;
    this.pastePreview = this.parseGlossaryPaste(this.pasteSource);
    this.pasteParsed = true;

    if (!this.pastePreview.length) {
      this.error = this.translation.instant('admin.ai.pasteNothing');
    }
    this.cdr.markForCheck();
  }

  applyPaste(): void {
    if (!this.pastePreview.length) {
      return;
    }
    const count = this.pastePreview.length;

    this.saving = true;
    this.error = null;

    this.ai
      .saveGlossary(this.pastePreview)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving = false;
          this.showPaste = false;
          this.resetPaste();
          this.notifications.success(this.translation.instant('admin.ai.pasteAdded', { count }));
          this.loadGlossary();
        },
        error: err => {
          console.error('Failed to save pasted glossary:', err);
          this.error = this.translation.instant('admin.ai.glossarySaveError');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Parses a pasted table into glossary rows.
   *
   * Accepts the two shapes the seed document uses, distinguished by their
   * header row so either table can be pasted exactly as written:
   *
   *   Term | Note              → never-translate rows
   *   Term (EN) | uk | pl      → one pinned row per language column
   *
   * Markdown pipes, tabs, separator rows and comments are all tolerated,
   * because the paste is coming from a document, a spreadsheet or a chat
   * window and demanding one exact format would just move the chore.
   */
  private parseGlossaryPaste(source: string): AIGlossaryTerm[] {
    const rows = source
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('>'))
      .map(line => this.splitCells(line))
      .filter(cells => cells.length > 0 && !this.isSeparatorRow(cells));

    if (!rows.length) {
      return [];
    }

    const languageColumns = this.languageColumns(rows[0]);
    const body = languageColumns.length || this.isHeaderRow(rows[0]) ? rows.slice(1) : rows;

    const terms: AIGlossaryTerm[] = [];
    const seen = new Set<string>();

    const push = (term: AIGlossaryTerm) => {
      const key = `${term.term.toLowerCase()}|${(term.language || '').toLowerCase()}|${term.do_not_translate}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      // Re-pasting a corrected table must update the rows it already created
      // rather than doubling them, so an existing row lends its uid.
      const existing = this.findExistingTerm(term);
      terms.push(existing ? { ...term, uid: existing.uid } : term);
    };

    for (const cells of body) {
      const term = cells[0];
      if (!term) {
        continue;
      }

      if (languageColumns.length) {
        languageColumns.forEach((language, index) => {
          const translation = cells[index + 1];
          if (translation) {
            push({ term, language, translation, do_not_translate: false });
          }
        });
        continue;
      }

      // Narrow form. Three cells whose middle is a language code is a pinned
      // translation; anything else is a term with an optional note.
      if (cells.length >= 3 && this.isLanguageCode(cells[1]) && cells[2]) {
        push({ term, language: cells[1].toLowerCase(), translation: cells[2], do_not_translate: false });
      } else {
        push({ term, do_not_translate: true, notes: cells[1] || '' });
      }
    }

    return terms;
  }

  private splitCells(line: string): string[] {
    const raw = line.includes('|') ? line.split('|') : line.split('\t');
    return raw
      .map(cell => cell.trim().replace(/^\*\*|\*\*$/g, '').replace(/^`|`$/g, '').trim())
      .filter((cell, index, all) => !(cell === '' && (index === 0 || index === all.length - 1)));
  }

  private isSeparatorRow(cells: string[]): boolean {
    return cells.every(cell => /^:?-{2,}:?$/.test(cell));
  }

  private isHeaderRow(cells: string[]): boolean {
    return /^term\b/i.test(cells[0] || '');
  }

  /**
   * Language codes named by a header row, or [] when this is not a wide table.
   *
   * A cell counts as a language only if it is a two-letter code or a code the
   * hub already knows — otherwise "Note" would read as a language and the
   * never-translate table would import as nonsense.
   */
  private languageColumns(header: string[]): string[] {
    if (header.length < 2 || !this.isHeaderRow(header)) {
      return [];
    }
    const columns = header.slice(1);
    return columns.every(cell => this.isLanguageCode(cell)) ? columns.map(c => c.toLowerCase()) : [];
  }

  private isLanguageCode(value: string): boolean {
    const code = (value || '').trim().toLowerCase();
    return /^[a-z]{2}$/.test(code) || this.languages.includes(code);
  }

  private findExistingTerm(term: AIGlossaryTerm): AIGlossaryTerm | undefined {
    return this.glossary.find(
      existing =>
        existing.term.toLowerCase() === term.term.toLowerCase() &&
        (existing.language || '').toLowerCase() === (term.language || '').toLowerCase() &&
        existing.do_not_translate === term.do_not_translate
    );
  }

  get pasteNeverCount(): number {
    return this.pastePreview.filter(t => t.do_not_translate).length;
  }

  get pastePinnedCount(): number {
    return this.pastePreview.filter(t => !t.do_not_translate).length;
  }

  trackByUID(_: number, term: AIGlossaryTerm): string {
    return term.uid || term.term;
  }

  trackByOperation(_: number, row: AIUsageSummary): string {
    return row.operation;
  }

  formatNumber(value: number): string {
    return (value || 0).toLocaleString();
  }
}
