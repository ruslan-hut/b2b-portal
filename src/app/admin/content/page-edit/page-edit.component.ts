import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import {
  BLOCK_ICONS,
  BlockType,
  ContentBlock,
  ContentImportResult,
  ContentLanguage,
  ContentLayout,
  ContentPage,
  ContentPageTranslation,
  blockCarriesText
} from '../../../core/models/content-page.model';
import { ContentFile } from '../../../core/models/content-file.model';
import { AIAvailability, AITranslateBlock, AITranslateProposal } from '../../../core/models/ai.model';
import { AIService } from '../../../core/services/ai.service';
import { UnsavedChangesAware } from '../../../core/guards/unsaved-changes.guard';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ContentFileService } from '../../../core/services/content-file.service';
import { ContentPageService } from '../../../core/services/content-page.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { StoreService } from '../../../core/services/store.service';
import { TranslationService } from '../../../core/services/translation.service';

interface StoreOption {
  uid: string;
  name: string;
}

/** A page offered as a link-card target, titled in the language being edited. */
interface PageOption {
  uid: string;
  slug: string;
  /** Full slug chain — what a card linking to this page must point at. */
  path: string;
  title: string;
  icon?: string;
}

/** Icon-registry names offered by the page-icon picker (DESIGN_POLICY §11). */
const ICON_CHOICES = [
  'description', 'menu_book', 'gavel', 'workspace_premium', 'inventory_2',
  'campaign', 'local_offer', 'school', 'science', 'palette', 'brush',
  'health_and_safety', 'public', 'euro', 'receipt_long', 'photo_library',
  'support_agent', 'handshake', 'star', 'folder'
];

@Component({
  selector: 'app-content-page-edit',
  templateUrl: './page-edit.component.html',
  styleUrls: ['./page-edit.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentPageEditComponent implements OnInit, UnsavedChangesAware {
  private destroyRef = inject(DestroyRef);

  page: ContentPage = this.blankPage();
  languages: ContentLanguage[] = [];
  stores: StoreOption[] = [];
  mediaFiles: ContentFile[] = [];

  /**
   * Every page, offered as a link-card target.
   *
   * Rebuilt rather than computed in the template: the titles depend on the
   * language being edited, and a getter would hand a fresh array to change
   * detection on every cycle.
   */
  pageOptions: PageOption[] = [];
  private allPages: ContentPage[] = [];

  /** Which translation the title/summary and block payload fields edit. */
  activeLanguage = '';
  isCreating = true;
  loading = false;
  saving = false;
  error: string | null = null;

  /**
   * Whether this page carries edits that are not on the server.
   *
   * The one piece of state an editor needs at all times and previously had no
   * way to read: every route out of here — breadcrumb, sidebar, back button —
   * used to discard an hour's work without a word. A flag rather than a diff
   * against a snapshot: the page is a deep object with per-language payload
   * maps, and a structural comparison on every keystroke buys nothing over
   * "something was typed".
   */
  dirty = false;

  /** When the last successful save landed, for the bar's state chip. */
  lastSavedAt: Date | null = null;

  showAudience = false;
  showIconPicker = false;
  readonly iconChoices = ICON_CHOICES;
  readonly blockIcons = BLOCK_ICONS;

  /** Index of the block whose editor drawer is open, or null. */
  openBlockIndex: number | null = null;

  reachSummary: string | null = null;
  private reachRequest = new Subject<void>();

  /**
   * AI assistance. Null until the availability probe answers, and the actions
   * stay hidden until then — an assistant that is off must leave the editor
   * exactly as it was, not leave a dead button behind.
   */
  aiAvailability: AIAvailability | null = null;
  translating = false;
  proposal: AITranslateProposal | null = null;

  /**
   * Waiting state for a translation.
   *
   * The model translates the whole page in one call and reports nothing until
   * it is done, so there is no honest percentage to show. What the editor
   * actually needs to know is that it is still running, how long it has been
   * running, and that they can walk away from it — hence elapsed seconds and a
   * cancel, not a fake bar creeping to 90%.
   */
  translateSource = '';
  translateBlockCount = 0;
  translateElapsed = 0;
  private translateCancel = new Subject<void>();
  private translateTimer: ReturnType<typeof setInterval> | null = null;

  /** After this many seconds the wait stops looking normal and says so. */
  private readonly slowTranslateSeconds = 45;
  /** Block UIDs the editor has ticked in the review panel. */
  acceptedBlocks = new Set<string>();
  acceptTitle = true;

  /**
   * Import — the migration path off the public Notion page.
   *
   * Paste rather than fetch-by-URL: the source's attachment links are signed
   * and expire, and a server that fetched whatever a paste pointed at would be
   * a request forwarder. Notion's own export (or a plain copy) carries
   * everything the converter needs.
   */
  showImport = false;
  importSource = '';
  importing = false;
  importResult: ContentImportResult | null = null;
  importReplace = false;
  importUseTitle = true;
  importError: string | null = null;

  readonly layouts: { value: ContentLayout; labelKey: string; hintKey: string }[] = [
    { value: 'article', labelKey: 'admin.content.layoutArticle', hintKey: 'admin.content.layoutArticleHint' },
    { value: 'hub', labelKey: 'admin.content.layoutHub', hintKey: 'admin.content.layoutHubHint' },
    { value: 'library', labelKey: 'admin.content.layoutLibrary', hintKey: 'admin.content.layoutLibraryHint' }
  ];

  readonly blockPalette: { type: BlockType; labelKey: string }[] = [
    { type: 'heading', labelKey: 'admin.content.blockHeading' },
    { type: 'text', labelKey: 'admin.content.blockText' },
    { type: 'callout', labelKey: 'admin.content.blockCallout' },
    { type: 'files', labelKey: 'admin.content.blockFiles' },
    { type: 'image', labelKey: 'admin.content.blockImage' },
    { type: 'link_cards', labelKey: 'admin.content.blockLinkCards' },
    { type: 'divider', labelKey: 'admin.content.blockDivider' }
  ];

  readonly calloutTones = [
    { value: 'info', labelKey: 'admin.content.toneInfo' },
    { value: 'warn', labelKey: 'admin.content.toneWarn' },
    { value: 'success', labelKey: 'admin.content.toneSuccess' },
    { value: 'danger', labelKey: 'admin.content.toneDanger' }
  ];

  /**
   * Translation key for a block type.
   *
   * A lookup rather than string concatenation in the template: building keys
   * with `'…block' + (type | titlecase)` silently produces `blockLink_cards`
   * for snake_case types, and the translate pipe then renders the raw key on
   * screen. The compiler cannot catch that.
   */
  blockLabelKey(type: BlockType): string {
    return this.blockPalette.find(b => b.type === type)?.labelKey || type;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pages: ContentPageService,
    private files: ContentFileService,
    private stores$: StoreService,
    private cdr: ChangeDetectorRef,
    private pageTitle: PageTitleService,
    private translation: TranslationService,
    private confirmDialog: ConfirmDialogService,
    private notifications: NotificationService,
    private ai: AIService
  ) {}

  ngOnInit(): void {
    this.loadLanguages();
    this.loadStores();
    this.loadMedia();
    this.loadPageOptions();
    this.loadAIAvailability();

    // The reach query hits the database, so it trails the editor's typing
    // rather than firing per keystroke.
    this.reachRequest
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetchReach());

    const uid = this.route.snapshot.paramMap.get('uid');
    if (uid) {
      this.isCreating = false;
      this.loadPage(uid);
    } else {
      this.page = this.blankPage();
      this.page.parent_uid = this.route.snapshot.queryParamMap.get('parent') || '';
      this.pageTitle.setTitle(this.translation.instant('admin.content.newPage'));
    }
  }

  private blankPage(): ContentPage {
    return {
      uid: '',
      slug: '',
      sort_order: 0,
      layout: 'article',
      status: 'draft',
      staff_only: false,
      translations: [],
      blocks: [],
      languages: [],
      countries: []
    };
  }

  private loadPage(uid: string): void {
    this.loading = true;
    this.pages
      .getPage(uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.page = { ...this.blankPage(), ...page };
          this.page.translations = page.translations || [];
          // settings and payloads come back null for blocks that have none;
          // the editor binds into them directly, so normalise to objects here
          // rather than guarding at every binding site.
          this.page.blocks = (page.blocks || []).map(b => this.applyBlockDefaults({
            ...b,
            settings: b.settings || {},
            payloads: b.payloads || []
          }));
          this.page.languages = page.languages || [];
          this.page.countries = page.countries || [];
          this.pickInitialLanguage();
          // The page's own uid is only known now, and it is what the target
          // picker excludes.
          this.rebuildPageOptions();
          this.loading = false;
          this.pageTitle.setTitle(this.titleForActive() || this.translation.instant('admin.content.title'));
          this.requestReach();
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to load page:', err);
          this.error = this.translation.instant('admin.content.loadError');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadLanguages(): void {
    this.pages
      .listLanguagesAdmin()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: languages => {
          this.languages = languages.filter(l => l.active);
          this.pickInitialLanguage();
          this.cdr.markForCheck();
        },
        error: err => console.error('Failed to load languages:', err)
      });
  }

  private loadStores(): void {
    this.stores$
      .getStores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: stores => {
          // StoreService is a cached lookup keyed by uid, so it hands back a
          // map rather than a list.
          this.stores = Object.values(stores || {})
            .map(s => ({ uid: s.uid, name: s.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
          this.cdr.markForCheck();
        },
        error: err => console.error('Failed to load stores:', err)
      });
  }

  /**
   * The page list behind the card target picker.
   *
   * Failure is silent and non-blocking: the address field still accepts a
   * typed path, so a picker that could not load costs convenience, not the
   * ability to author the block.
   */
  private loadPageOptions(): void {
    this.pages
      .listPages()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: pages => {
          this.allPages = pages || [];
          this.rebuildPageOptions();
          this.cdr.markForCheck();
        },
        error: err => console.error('Failed to load pages:', err)
      });
  }

  private rebuildPageOptions(): void {
    this.pageOptions = this.allPages
      // A card pointing at the page it sits on is a loop the editor should not
      // offer, however harmless it is to click.
      .filter(p => p.uid !== this.page.uid)
      .map(p => ({
        uid: p.uid,
        slug: p.slug,
        path: p.path || p.slug,
        title: this.pages.titleFor(p, this.activeLanguage),
        icon: p.icon
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  private loadMedia(): void {
    this.files
      .list({ count: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.mediaFiles = result.files;
          this.cdr.markForCheck();
        },
        error: err => console.error('Failed to load media:', err)
      });
  }

  private pickInitialLanguage(): void {
    if (this.activeLanguage) return;
    const existing = this.page.translations?.[0]?.language;
    this.activeLanguage = existing || this.languages[0]?.code || 'en';
    this.rebuildPageOptions();
  }

  // --- translations ---------------------------------------------------------

  /** Languages this page already has a translation for. */
  get translatedCodes(): string[] {
    return (this.page.translations || []).map(t => t.language);
  }

  /** Registry languages not yet translated, offered by the "+" chip. */
  get untranslatedLanguages(): ContentLanguage[] {
    const have = new Set(this.translatedCodes);
    return this.languages.filter(l => !have.has(l.code));
  }

  translationFor(language: string): ContentPageTranslation {
    let t = (this.page.translations || []).find(x => x.language === language);
    if (!t) {
      t = { language, title: '', summary: '' };
      this.page.translations = [...(this.page.translations || []), t];
    }
    return t;
  }

  get activeTranslation(): ContentPageTranslation {
    return this.translationFor(this.activeLanguage);
  }

  selectLanguage(code: string): void {
    this.activeLanguage = code;
    this.openBlockIndex = null;
    this.rebuildPageOptions();
    this.cdr.markForCheck();
  }

  addLanguage(code: string): void {
    if (!code) return;
    this.translationFor(code);
    this.activeLanguage = code;
    this.rebuildPageOptions();
    this.markDirty();
    this.cdr.markForCheck();
  }

  async removeLanguage(code: string): Promise<void> {
    const message = this.translation.instant('admin.content.removeLanguageConfirm', { code: code.toUpperCase() });
    if (!(await this.confirmDialog.ask({ message, danger: true }))) return;

    this.page.translations = (this.page.translations || []).filter(t => t.language !== code);
    for (const block of this.page.blocks || []) {
      block.payloads = (block.payloads || []).filter(p => p.language !== code);
    }
    if (this.activeLanguage === code) {
      this.activeLanguage = this.translatedCodes[0] || this.languages[0]?.code || 'en';
      this.rebuildPageOptions();
    }
    this.markDirty();
    this.cdr.markForCheck();
  }

  /**
   * Seeds the active language from another one.
   *
   * The single biggest editorial advantage over the Notion original, where
   * every language is a hand-duplicated page.
   */
  copyFromLanguage(source: string): void {
    if (!source || source === this.activeLanguage) return;

    const from = this.translationFor(source);
    const to = this.translationFor(this.activeLanguage);
    to.title = from.title;
    to.summary = from.summary;

    for (const block of this.page.blocks || []) {
      if (!blockCarriesText(block.block_type)) continue;
      const sourcePayload = (block.payloads || []).find(p => p.language === source);
      if (!sourcePayload) continue;
      const target = this.payloadFor(block, this.activeLanguage);
      // Deep copy so editing the copy cannot mutate the source.
      Object.assign(target.payload, JSON.parse(JSON.stringify(sourcePayload.payload)));
    }

    this.markDirty();
    this.notifications.success(
      this.translation.instant('admin.content.copiedFrom', { code: source.toUpperCase() })
    );
    this.cdr.markForCheck();
  }

  // --- translation rail -----------------------------------------------------

  /**
   * How much of this page exists in a given language.
   *
   * The rail's whole reason for being. In a four-market hub the expensive
   * mistake is not an ugly page, it is a page live in Polish and silently
   * blank in Ukrainian — so completeness is counted per language and shown
   * before an editor has to go looking for it.
   *
   * The title counts as one unit alongside the text-carrying blocks: a
   * translation with no title is not a translation, and save() drops it.
   */
  languageProgress(code: string): { filled: number; total: number; percent: number } {
    const blocks = (this.page.blocks || []).filter(b => blockCarriesText(b.block_type));
    const total = blocks.length + 1;

    const title = (this.page.translations || []).find(t => t.language === code)?.title || '';
    let filled = title.trim() ? 1 : 0;

    for (const block of blocks) {
      const payload = (block.payloads || []).find(p => p.language === code)?.payload;
      if (payload && this.hasText(payload)) filled++;
    }

    return { filled, total, percent: total ? Math.round((filled / total) * 100) : 0 };
  }

  /** Registry name for a code, falling back to the code itself. */
  languageName(code: string): string {
    return this.languages.find(l => l.code === code)?.name || code.toUpperCase();
  }

  /**
   * Translated languages in registry order.
   *
   * Registry order rather than insertion order so the rail does not reshuffle
   * itself as an editor adds languages.
   */
  get railCodes(): string[] {
    const have = new Set(this.translatedCodes);
    const ordered = this.languages.filter(l => have.has(l.code)).map(l => l.code);
    // A translation for a language since removed from the registry still has
    // to be reachable, or its text becomes uneditable.
    const orphans = this.translatedCodes.filter(c => !this.languages.some(l => l.code === c));
    return [...ordered, ...orphans];
  }

  // --- outline --------------------------------------------------------------

  /** Opens a block from the outline and brings it into view. */
  focusBlock(index: number): void {
    this.openBlockIndex = index;
    this.cdr.markForCheck();

    // Deferred a frame: the editor drawer this scrolls to is rendered by the
    // change detection pass that has not run yet.
    setTimeout(() => {
      document
        .getElementById(`pe-block-${index}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  /** Short label for an outline row — heading level, or the block type. */
  outlineKind(block: ContentBlock): string {
    if (block.block_type === 'heading') {
      return `H${this.activePayload(block)['level'] || 2}`;
    }
    return this.translation.instant(this.blockLabelKey(block.block_type));
  }

  get isPublished(): boolean {
    return this.page.status === 'published';
  }

  // --- preview --------------------------------------------------------------

  /**
   * Renders the page as a partner would see it, through the same component the
   * partner route uses.
   *
   * In-memory, not saved: the point is to see the paragraph you just typed. So
   * it renders `page.blocks` with their unsaved `payloads[]` for the active
   * language, and the panel says as much rather than letting an editor assume
   * they are looking at what is live.
   */
  showPreview = false;

  /**
   * Preview width. An imported composition table fits a 68ch column and falls
   * off a phone, and the editor has no other way to find that out.
   */
  previewWidth: 'page' | 'phone' = 'page';

  openPreview(): void {
    this.showPreview = true;
    this.cdr.markForCheck();
  }

  closePreview(): void {
    this.showPreview = false;
    this.cdr.markForCheck();
  }

  setPreviewWidth(width: 'page' | 'phone'): void {
    this.previewWidth = width;
    this.cdr.markForCheck();
  }

  /** Escape closes the preview. The review and import panels own their own. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showPreview) {
      this.closePreview();
      return;
    }
    if (this.showIconPicker) {
      this.showIconPicker = false;
      this.cdr.markForCheck();
    }
  }

  /** Blocks carrying nothing in the active language would preview as gaps. */
  get previewHasContent(): boolean {
    return (this.page.blocks || []).length > 0 || !!this.activeTranslation.title.trim();
  }

  /** Where this page lives once saved and published. Empty while creating. */
  get partnerUrl(): string {
    return this.isCreating || !this.page.slug ? '' : `/partners/${this.slugChain()}`;
  }

  /**
   * The address as the editor types it, ancestors included.
   *
   * Built from the live slug rather than the saved `path`, so renaming the
   * address updates the hint before the page is saved. Ancestors come from the
   * flat list, which is loaded for the card target picker anyway.
   */
  get partnerPath(): string {
    return `/partners/${this.slugChain() || '…'}`;
  }

  private slugChain(): string {
    const byUID = new Map(this.allPages.map(p => [p.uid, p]));
    const segments = this.page.slug ? [this.page.slug] : ['…'];

    const seen = new Set<string>([this.page.uid]);
    let parent = this.page.parent_uid;
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const node = byUID.get(parent);
      if (!node) break;
      segments.unshift(node.slug);
      parent = node.parent_uid;
    }
    return segments.join('/');
  }

  // --- AI translation -------------------------------------------------------

  private loadAIAvailability(): void {
    this.ai
      .getAvailability()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: availability => {
          this.aiAvailability = availability;
          this.cdr.markForCheck();
        },
        // The assistant is an accelerator, never a dependency: a failed probe
        // simply means no ✨ actions.
        error: () => undefined
      });
  }

  /** Whether to offer ✨ Translate at all. */
  get canTranslate(): boolean {
    return !!this.aiAvailability?.available && !this.isCreating && this.translatedCodes.length > 0;
  }

  /**
   * Runs the whole page through the assistant and opens the review panel.
   *
   * Translates the *saved* page: block payloads are keyed by uid and a block
   * added since the last save has no stored counterpart. Saying so in the
   * panel is cheaper than silently dropping it.
   */
  translateFromLanguage(source: string): void {
    if (!source || source === this.activeLanguage || this.translating) return;

    this.translating = true;
    this.error = null;
    this.translateSource = source;
    this.translateBlockCount = this.countTranslatableBlocks(source);
    this.startTranslateTimer();
    this.cdr.markForCheck();

    this.ai
      .translatePage({ page_uid: this.page.uid, from: source, to: this.activeLanguage })
      .pipe(takeUntil(this.translateCancel), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: proposal => {
          this.stopTranslateTimer();
          this.translating = false;
          this.proposal = proposal;
          this.acceptTitle = !proposal.refused;
          // Everything ticked by default: an editor scanning thirty blocks is
          // looking for the one to reject, not confirming twenty-nine.
          this.acceptedBlocks = new Set(
            (proposal.blocks || []).filter(b => b.warning !== 'missing_from_response').map(b => b.uid)
          );
          this.cdr.markForCheck();
        },
        error: err => {
          this.stopTranslateTimer();
          this.translating = false;
          this.error = err?.error?.error?.message
            || err?.error?.message
            || this.translation.instant('admin.content.ai.translateError');
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Cancels the in-flight translation.
   *
   * Unsubscribing aborts the request, which drops the connection, which cancels
   * the request context on the server and with it the model call — so a cancel
   * stops the spend rather than merely hiding the wait.
   */
  cancelTranslate(): void {
    if (!this.translating) return;

    this.translateCancel.next();
    this.stopTranslateTimer();
    this.translating = false;
    this.cdr.markForCheck();
  }

  get translateIsSlow(): boolean {
    return this.translateElapsed >= this.slowTranslateSeconds;
  }

  /** Elapsed time as m:ss. */
  get translateElapsedLabel(): string {
    const minutes = Math.floor(this.translateElapsed / 60);
    const seconds = this.translateElapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private startTranslateTimer(): void {
    this.translateElapsed = 0;
    this.stopTranslateTimer();
    this.translateTimer = setInterval(() => {
      this.translateElapsed++;
      this.cdr.markForCheck();
    }, 1000);
  }

  private stopTranslateTimer(): void {
    if (this.translateTimer !== null) {
      clearInterval(this.translateTimer);
      this.translateTimer = null;
    }
  }

  /**
   * How many blocks the request will carry.
   *
   * Counted generically — any block that carries text and holds a non-empty
   * string in the source language — rather than by replicating the backend's
   * per-type field inventory, which would drift the first time a block type
   * gains a field.
   */
  private countTranslatableBlocks(source: string): number {
    return (this.page.blocks || []).filter(block => {
      if (!blockCarriesText(block.block_type)) return false;
      const payload = (block.payloads || []).find(p => p.language === source)?.payload;
      return !!payload && this.hasText(payload);
    }).length;
  }

  private hasText(value: unknown): boolean {
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.some(v => this.hasText(v));
    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).some(v => this.hasText(v));
    }
    return false;
  }

  toggleAcceptBlock(uid: string): void {
    if (this.acceptedBlocks.has(uid)) {
      this.acceptedBlocks.delete(uid);
    } else {
      this.acceptedBlocks.add(uid);
    }
    this.cdr.markForCheck();
  }

  isAccepted(uid: string): boolean {
    return this.acceptedBlocks.has(uid);
  }

  get allBlocksAccepted(): boolean {
    const blocks = this.proposal?.blocks || [];
    return blocks.length > 0 && blocks.every(b => this.acceptedBlocks.has(b.uid));
  }

  toggleAcceptAll(): void {
    if (this.allBlocksAccepted) {
      this.acceptedBlocks.clear();
      this.acceptTitle = false;
    } else {
      this.acceptedBlocks = new Set((this.proposal?.blocks || []).map(b => b.uid));
      this.acceptTitle = true;
    }
    this.cdr.markForCheck();
  }

  get acceptedCount(): number {
    return this.acceptedBlocks.size + (this.acceptTitle ? 1 : 0);
  }

  /**
   * Applies the ticked rows to the active language.
   *
   * In memory only — the page is written by the ordinary save that follows, so
   * an editor who changes their mind can still leave without saving.
   */
  applyProposal(): void {
    const proposal = this.proposal;
    if (!proposal) return;

    if (this.acceptTitle) {
      const target = this.translationFor(this.activeLanguage);
      target.title = proposal.title.proposed || target.title;
      target.summary = proposal.summary.proposed || target.summary;
    }

    let applied = 0;
    for (const proposed of proposal.blocks || []) {
      if (!this.acceptedBlocks.has(proposed.uid)) continue;

      // Matched by uid, never by position: a block reordered since the request
      // would otherwise take another block's text.
      const block = (this.page.blocks || []).find(b => b.uid === proposed.uid);
      if (!block) continue;

      this.payloadFor(block, this.activeLanguage).payload = { ...proposed.payload };
      applied++;
    }

    this.proposal = null;
    this.acceptedBlocks.clear();

    this.markDirty();
    this.notifications.success(
      this.translation.instant('admin.content.ai.applied', { count: applied })
    );
    this.cdr.markForCheck();
  }

  discardProposal(): void {
    this.proposal = null;
    this.acceptedBlocks.clear();
    this.cdr.markForCheck();
  }

  // --- import ---------------------------------------------------------------

  openImport(): void {
    this.showImport = true;
    this.importError = null;
    this.cdr.markForCheck();
  }

  closeImport(): void {
    this.showImport = false;
    this.importResult = null;
    this.importSource = '';
    this.importError = null;
    this.cdr.markForCheck();
  }

  /**
   * Reads a Notion export file into the paste box.
   *
   * Client-side: the file is text the converter would receive anyway, and
   * uploading it would put a second file-handling path next to the media
   * library for no gain.
   */
  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.importSource = String(reader.result || '');
      this.importResult = null;
      this.cdr.markForCheck();
    };
    reader.onerror = () => {
      this.importError = this.translation.instant('admin.content.import.readError');
      this.cdr.markForCheck();
    };
    reader.readAsText(file);

    // Clear so choosing the same file twice fires the change event again.
    input.value = '';
  }

  convertImport(): void {
    const source = this.importSource.trim();
    if (!source || this.importing) return;

    this.importing = true;
    this.importError = null;
    this.cdr.markForCheck();

    this.pages
      .importContent({ source, format: 'auto', language: this.activeLanguage })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.importing = false;
          this.importResult = result;
          this.importUseTitle = !!result.title && !this.activeTranslation.title;
          this.cdr.markForCheck();
        },
        error: err => {
          this.importing = false;
          this.importError = err?.error?.error?.message
            || err?.error?.message
            || this.translation.instant('admin.content.import.failed');
          this.cdr.markForCheck();
        }
      });
  }

  /** Documents in the proposal that matched a media library file. */
  get importMatchedLabel(): string {
    const result = this.importResult;
    if (!result) return '';
    return this.translation.instant('admin.content.import.filesSummary', {
      matched: result.files_matched,
      missing: result.files_missing
    });
  }

  importWarningsOf(code: string): string[] {
    return (this.importResult?.warnings || [])
      .filter(w => w.code === code)
      .map(w => w.detail);
  }

  /** A one-line preview of what a proposed block will render as. */
  importPreview(block: ContentBlock): string {
    const payload = (block.payloads || [])[0]?.payload || {};

    switch (block.block_type) {
      case 'heading':
      case 'callout':
        return String(payload['text'] || '');
      case 'text':
        return String(payload['html'] || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      case 'image':
        return String(payload['caption'] || '');
      case 'files':
      case 'link_cards': {
        const items = (payload['items'] as any[]) || [];
        return items.map(i => i['label'] || i['title'] || i['filename'] || '').filter(Boolean).join(' · ');
      }
      default:
        return '';
    }
  }

  /** How many documents in a files block are still waiting for an upload. */
  importUnresolvedCount(block: ContentBlock): number {
    if (block.block_type !== 'files') return 0;
    const items = ((block.payloads || [])[0]?.payload?.['items'] as any[]) || [];
    return items.filter(i => !i['file_uid']).length;
  }

  /**
   * Inserts the proposal into the page.
   *
   * Local only — the editor still has to save, which is what makes a bad paste
   * cost a discard rather than a repair.
   */
  applyImport(): void {
    const result = this.importResult;
    if (!result) return;

    const imported = (result.blocks || []).map(block => this.applyBlockDefaults({
      ...block,
      uid: this.uuid(),
      settings: block.settings || {},
      payloads: block.payloads || []
    }));

    this.page.blocks = this.importReplace
      ? imported
      : [...(this.page.blocks || []), ...imported];
    this.page.blocks.forEach((b, i) => (b.sort_order = i));

    if (this.importUseTitle && result.title) {
      this.activeTranslation.title = result.title;
      this.onTitleInput();
    }

    const count = imported.length;
    this.closeImport();
    this.markDirty();
    this.notifications.success(this.translation.instant('admin.content.import.applied', { count }));
    this.cdr.markForCheck();
  }

  /** Label for a proposed block, so the review panel names what is changing. */
  proposedBlockLabel(block: AITranslateBlock): string {
    return this.translation.instant(this.blockLabelKey(block.block_type as BlockType));
  }

  trackProposedBlock(_: number, block: AITranslateBlock): string {
    return block.uid;
  }

  titleForActive(): string {
    return this.activeTranslation.title;
  }

  /** Auto-fills the slug from the title while creating, never after. */
  onTitleInput(): void {
    if (!this.isCreating || !this.page.slug) {
      this.page.slug = this.slugify(this.activeTranslation.title);
    }
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // --- blocks ---------------------------------------------------------------

  payloadFor(block: ContentBlock, language: string) {
    block.payloads = block.payloads || [];
    let payload = block.payloads.find(p => p.language === language);
    if (!payload) {
      payload = { language, payload: {} };
      block.payloads.push(payload);
    }
    payload.payload = payload.payload || {};
    return payload;
  }

  /** The payload object bound by the block editor for the active language. */
  activePayload(block: ContentBlock): Record<string, any> {
    return this.payloadFor(block, this.activeLanguage).payload;
  }

  addBlock(type: BlockType): void {
    const block: ContentBlock = {
      uid: this.uuid(),
      block_type: type,
      sort_order: (this.page.blocks || []).length,
      settings: {},
      payloads: []
    };

    if (type === 'files' || type === 'link_cards') {
      this.activePayload(block)['items'] = [];
    }
    this.applyBlockDefaults(block);
    if (type === 'heading') {
      this.activePayload(block)['level'] = 2;
    }
    if (type === 'callout') {
      this.activePayload(block)['tone'] = 'info';
    }

    this.page.blocks = [...(this.page.blocks || []), block];
    this.openBlockIndex = this.page.blocks.length - 1;
    this.markDirty();
    this.cdr.markForCheck();
  }

  toggleBlock(index: number): void {
    this.openBlockIndex = this.openBlockIndex === index ? null : index;
    this.cdr.markForCheck();
  }

  moveBlock(index: number, delta: number): void {
    const blocks = this.page.blocks || [];
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;

    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    blocks.forEach((b, i) => (b.sort_order = i));
    this.openBlockIndex = target;
    this.markDirty();
    this.cdr.markForCheck();
  }

  async removeBlock(index: number): Promise<void> {
    const message = this.translation.instant('admin.content.removeBlockConfirm');
    if (!(await this.confirmDialog.ask({ message, danger: true }))) return;

    this.page.blocks = (this.page.blocks || []).filter((_, i) => i !== index);
    this.page.blocks.forEach((b, i) => (b.sort_order = i));
    this.openBlockIndex = null;
    this.markDirty();
    this.cdr.markForCheck();
  }

  /** One-line preview shown on the collapsed block row. */
  blockSummary(block: ContentBlock): string {
    const payload = this.activePayload(block);
    switch (block.block_type) {
      case 'heading':
      case 'callout':
        return this.truncate(payload['text'] || '');
      case 'text':
        return this.truncate((payload['html'] || '').replace(/<[^>]*>/g, ' ').trim());
      case 'files':
      case 'link_cards':
        return this.translation.instant('admin.content.itemCount', {
          count: (payload['items'] || []).length
        });
      case 'image':
        return this.fileName(block.settings?.['file_uid']);
      default:
        return '';
    }
  }

  private truncate(value: string, max = 60): string {
    const text = value.trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  fileName(uid?: string): string {
    if (!uid) return '';
    return this.mediaFiles.find(f => f.uid === uid)?.filename || uid;
  }

  /**
   * Fills in the settings a block's selects bind to.
   *
   * Applied on load as well as on create: a select bound to an absent value
   * renders blank, and every block saved before a setting existed has none.
   */
  private applyBlockDefaults(block: ContentBlock): ContentBlock {
    if (block.block_type === 'link_cards') {
      const settings = block.settings!;
      settings['display'] = settings['display'] === 'cover' ? 'cover' : 'list';
      settings['columns'] = Number(settings['columns']) || 0;
    }
    return block;
  }

  // --- files / link-cards items --------------------------------------------

  itemsOf(block: ContentBlock): any[] {
    const payload = this.activePayload(block);
    payload['items'] = payload['items'] || [];
    return payload['items'];
  }

  addItem(block: ContentBlock): void {
    this.itemsOf(block).push(
      block.block_type === 'files'
        ? { file_uid: '', label: '', language: '', market: '' }
        : { page_uid: '', url: '', title: '', icon: '', description: '', file_uid: '' }
    );
    this.markDirty();
    this.cdr.markForCheck();
  }

  // --- link cards -----------------------------------------------------------

  /** Whether a cards block is in its picture-led form. */
  isCoverCards(block: ContentBlock): boolean {
    return block.settings?.['display'] === 'cover';
  }

  /**
   * Only images are offered as a card cover.
   *
   * The media library is mostly PDFs — offering them here would let an editor
   * pick a file that renders as a broken image, and only in production.
   */
  get imageFiles(): ContentFile[] {
    return this.mediaFiles.filter(f => f.mime_type?.startsWith('image/'));
  }

  /**
   * Turns a chosen page into the card's link.
   *
   * The stored value stays the URL, because that is what the renderer follows
   * and what an external card uses too. `page_uid` is kept alongside it as the
   * record of what was picked, so a later slug change is at least traceable.
   */
  onCardPageChange(item: Record<string, any>): void {
    const page = this.pageOptions.find(p => p.uid === item['page_uid']);
    if (!page) return;

    item['url'] = `/partners/${page.path}`;
    if (!item['title']) {
      item['title'] = page.title;
    }
    if (!item['icon'] && page.icon) {
      item['icon'] = page.icon;
    }
    this.cdr.markForCheck();
  }

  removeItem(block: ContentBlock, index: number): void {
    const items = this.itemsOf(block);
    items.splice(index, 1);
    this.markDirty();
    this.cdr.markForCheck();
  }

  /**
   * Pre-fills language and revision date from a filename.
   *
   * Real documents encode both — "1_SDS_Gel_paint_27_05_2026_en.pdf" — so the
   * editor confirms rather than types. Fails softly: an unparsed name simply
   * leaves the fields empty.
   */
  onItemFileChange(item: Record<string, any>): void {
    const file = this.mediaFiles.find(f => f.uid === item['file_uid']);
    if (!file) return;

    if (!item['label']) {
      item['label'] = file.filename.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ');
    }
    if (!item['language'] && file.language) {
      item['language'] = file.language;
    }
    if (!item['language']) {
      const match = file.filename.match(/[_\-\s]([a-z]{2})\.[a-z0-9]+$/i);
      if (match) item['language'] = match[1].toLowerCase();
    }
    this.cdr.markForCheck();
  }

  // --- audience -------------------------------------------------------------

  toggleAudience(): void {
    this.showAudience = !this.showAudience;
    if (this.showAudience) this.requestReach();
    this.cdr.markForCheck();
  }

  /** Comma-separated country codes, bound to a single text field. */
  get countriesText(): string {
    return (this.page.countries || []).join(', ');
  }

  set countriesText(value: string) {
    this.page.countries = value
      .split(',')
      .map(c => c.trim().toUpperCase())
      .filter(Boolean);
    this.requestReach();
  }

  toggleScopeLanguage(code: string): void {
    const scope = new Set(this.page.languages || []);
    scope.has(code) ? scope.delete(code) : scope.add(code);
    this.page.languages = [...scope];
    this.markDirty();
    this.cdr.markForCheck();
  }

  isScopedTo(code: string): boolean {
    return (this.page.languages || []).includes(code);
  }

  requestReach(): void {
    this.reachRequest.next();
  }

  private fetchReach(): void {
    this.pages
      .reach(this.page.countries || [])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: reach => {
          this.reachSummary = this.translation.instant('admin.content.reachSummary', {
            reached: reach.reached,
            withoutAddress: reach.without_address
          });
          this.cdr.markForCheck();
        },
        // A failed count must not block editing; the control simply shows nothing.
        error: () => {
          this.reachSummary = null;
          this.cdr.markForCheck();
        }
      });
  }

  audienceSummary(): string {
    const parts: string[] = [];
    if (this.page.countries?.length) parts.push(this.page.countries.join(', '));
    if (this.page.languages?.length) parts.push(this.page.languages.join(', ').toUpperCase());
    if (this.page.store_uid) parts.push(this.translation.instant('admin.content.oneStore'));
    if (this.page.staff_only) parts.push(this.translation.instant('admin.content.staffOnly'));
    return parts.length
      ? parts.join(' · ')
      : this.translation.instant('admin.content.audienceEveryone');
  }

  // --- icon picker ----------------------------------------------------------

  toggleIconPicker(): void {
    this.showIconPicker = !this.showIconPicker;
    this.cdr.markForCheck();
  }

  /**
   * Clicking anywhere else closes the picker.
   *
   * It is a popover that pushes the form down while it is open, so leaving it
   * open after the editor has moved on costs them the layout they were reading.
   */
  @HostListener('document:pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    if (!this.showIconPicker) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.pe-icon-grid, .pe-icon-button')) return;
    this.showIconPicker = false;
    this.cdr.markForCheck();
  }

  chooseIcon(icon: string): void {
    this.page.icon = icon;
    this.showIconPicker = false;
    this.markDirty();
    this.cdr.markForCheck();
  }

  // --- unsaved work ---------------------------------------------------------

  /**
   * Every edit funnels through here.
   *
   * A host listener rather than a hundred `(ngModelChange)` bindings: `input`
   * and `change` bubble, so one pair of handlers covers every field in the
   * editor including the ones a future block type adds. Structural edits —
   * adding a block, reordering, accepting a translation — do not raise an input
   * event, so those call `markDirty()` themselves.
   */
  @HostListener('input', ['$event'])
  @HostListener('change', ['$event'])
  onFieldEdit(event: Event): void {
    const target = event.target as HTMLElement | null;
    // Typing in the import box, ticking rows in the translation review, or
    // choosing a source language to translate from does not change the page —
    // those write to it only on accept, and mark it dirty themselves when they
    // do. Without this, opening the assistant and cancelling would leave the
    // page claiming edits it does not have.
    if (target?.closest('.pe-import, .pe-review, .pe-select--assist')) return;
    this.markDirty();
  }

  markDirty(): void {
    if (this.dirty) return;
    this.dirty = true;
    this.cdr.markForCheck();
  }

  /**
   * Saves without leaving the keyboard.
   *
   * ⌘S / Ctrl+S is what someone who writes for a living reaches for, and the
   * browser's own "save this page" is never what they meant.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
    event.preventDefault();
    // A modal owns the screen while it is open; saving underneath it would
    // write a page the editor cannot currently see.
    if (this.saving || this.showImport || this.proposal || this.translating) return;
    this.save();
  }

  /** Tab close and reload never reach the router, so they are caught here. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty) event.preventDefault();
  }

  /** Asked by the route guard for every navigation out of the editor. */
  confirmLeave(): Promise<boolean> | boolean {
    if (!this.dirty) return true;
    return this.confirmDialog.ask({
      title: this.translation.instant('admin.content.leaveTitle'),
      message: this.translation.instant('admin.content.leaveMessage'),
      confirmLabel: this.translation.instant('admin.content.leaveDiscard'),
      cancelLabel: this.translation.instant('admin.content.leaveStay'),
      danger: true
    });
  }

  // --- save -----------------------------------------------------------------

  save(publish?: boolean): void {
    this.error = null;

    const title = this.activeTranslation.title.trim();
    if (!title) {
      this.error = this.translation.instant('admin.content.errTitleRequired');
      return;
    }
    if (!this.page.slug) {
      this.page.slug = this.slugify(title);
    }
    if (!this.page.slug) {
      this.error = this.translation.instant('admin.content.errSlugRequired');
      return;
    }

    // Drop translations the editor opened but never filled: an empty title
    // would render as a blank entry in the partner's tree.
    this.page.translations = (this.page.translations || []).filter(t => t.title.trim());
    if (publish !== undefined) {
      this.page.status = publish ? 'published' : 'draft';
    }

    this.saving = true;
    this.pages
      .savePages([this.page])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: uids => {
          this.saving = false;
          // Cleared before the redirect: leaving /new for the page's own
          // address is a navigation, and the guard would otherwise ask an
          // editor whether they want to discard the work it just saved.
          this.dirty = false;
          this.lastSavedAt = new Date();
          this.notifications.success(this.translation.instant('admin.content.saved'));
          if (this.isCreating && uids.length) {
            this.router.navigate(['/admin/content', uids[0]]);
          } else {
            this.cdr.markForCheck();
          }
        },
        error: err => {
          this.saving = false;
          this.error =
            err?.error?.status_message || this.translation.instant('admin.content.saveError');
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Publishes, after asking.
   *
   * Split out of the old "Save draft / Publish" pair, which put an unguarded
   * `status = 'draft'` behind a button labelled *Save*: on an already-live page
   * that took it offline for every partner and reported it as a save. Going
   * live and coming back off are state changes now, and both are confirmed;
   * Save no longer touches publication at all.
   */
  async publish(): Promise<void> {
    const message = this.translation.instant('admin.content.publishConfirm');
    if (!(await this.confirmDialog.ask({ message }))) return;
    this.save(true);
  }

  async unpublish(): Promise<void> {
    const message = this.translation.instant('admin.content.unpublishConfirm');
    if (!(await this.confirmDialog.ask({ message, danger: true }))) return;
    this.save(false);
  }

  /** Absolute clock time, not "3 minutes ago" — no ticking, no rounding. */
  get savedAtLabel(): string {
    if (!this.lastSavedAt) return '';
    return this.lastSavedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  cancel(): void {
    // No confirm here: the route guard asks on every way out, and asking twice
    // teaches an editor to click through the question.
    this.router.navigate(['/admin/content']);
  }

  private uuid(): string {
    return crypto.randomUUID();
  }

  trackByIndex(index: number): number {
    return index;
  }
}
