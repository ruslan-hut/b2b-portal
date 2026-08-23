import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ContentLanguage,
  ContentPage,
  ContentPageReorder,
  FlatPageNode
} from '../../core/models/content-page.model';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ContentPageService } from '../../core/services/content-page.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageTitleService } from '../../core/services/page-title.service';
import { TranslationService } from '../../core/services/translation.service';

/** Which pages the list shows. Empty means all of them. */
type StateFilter = '' | 'published' | 'draft' | 'untranslated';

/** One destination in the move panel's parent picker. */
interface MoveOption {
  uid: string;
  label: string;
  path: string;
  depth: number;
}

/**
 * Partner Resources page tree (admin side).
 *
 * An indented table rather than a two-pane tree editor: it matches every other
 * admin module, so the action bar, pagination and confirm dialogs come for
 * free. Revisit at ~50 pages.
 */
@Component({
  selector: 'app-content',
  templateUrl: './content.component.html',
  styleUrls: ['./content.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  /** The whole tree, flattened. Filtering never touches it. */
  private allNodes: FlatPageNode[] = [];

  /** What the table renders — `allNodes` after search and the state filter. */
  nodes: FlatPageNode[] = [];
  languages: ContentLanguage[] = [];
  /** Which language's titles the list shows. */
  displayLanguage = 'en';

  loading = false;
  error: string | null = null;
  isAdmin = false;

  search = '';
  stateFilter: StateFilter = '';

  /** The page being reorganised, or null when the move panel is closed. */
  movingNode: FlatPageNode | null = null;
  /** Destination parent UID. '' is the root of the tree. */
  moveTarget = '';
  moveOptions: MoveOption[] = [];
  moveError: string | null = null;
  moving = false;

  /** The row being dragged, and where it would land. */
  dragging: FlatPageNode | null = null;
  dropTarget: FlatPageNode | null = null;
  dropAfter = false;
  reordering = false;

  /**
   * The states worth pulling a tree apart by.
   *
   * "Needs translation" earns its place next to the two publication states
   * because it is the failure this module exists to catch — and until now it
   * was only visible by reading the language chips on every row.
   */
  readonly stateFilters: { value: StateFilter; labelKey: string }[] = [
    { value: '', labelKey: 'common.all' },
    { value: 'published', labelKey: 'admin.content.published' },
    { value: 'draft', labelKey: 'admin.content.draft' },
    { value: 'untranslated', labelKey: 'admin.content.filterUntranslated' }
  ];

  constructor(
    private pages: ContentPageService,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private pageTitle: PageTitleService,
    private translation: TranslationService,
    private confirmDialog: ConfirmDialogService,
    private notifications: NotificationService
  ) {}

  ngOnInit(): void {
    this.pageTitle.setTitle(this.translation.instant('admin.content.title'));
    this.isAdmin = this.auth.isAdmin;
    this.displayLanguage = this.translation.getCurrentLanguage();
    this.loadLanguages();
    this.load();
  }

  private loadLanguages(): void {
    this.pages
      .listLanguagesAdmin()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: languages => {
          this.languages = languages.filter(l => l.active);
          // Prefer a language the hub actually has content in.
          if (this.languages.length && !this.languages.some(l => l.code === this.displayLanguage)) {
            this.displayLanguage = this.languages[0].code;
          }
          this.cdr.markForCheck();
        },
        error: err => console.error('Failed to load content languages:', err)
      });
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.pages
      .listPages()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: pages => {
          this.allNodes = this.pages.flatten(pages);
          this.applyFilters();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to load content pages:', err);
          this.error = this.translation.instant('admin.content.loadError');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onLanguageChange(): void {
    // Titles are language-specific, so a search matching on them has to be
    // re-run when the language they are read in changes.
    this.applyFilters();
    this.cdr.markForCheck();
  }

  // --- filtering ------------------------------------------------------------

  onSearchChange(): void {
    this.applyFilters();
    this.cdr.markForCheck();
  }

  setStateFilter(value: StateFilter): void {
    this.stateFilter = value;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  clearFilters(): void {
    this.search = '';
    this.stateFilter = '';
    this.applyFilters();
    this.cdr.markForCheck();
  }

  get filtersActive(): boolean {
    return !!this.search.trim() || !!this.stateFilter;
  }

  get totalCount(): number {
    return this.allNodes.length;
  }

  /**
   * Narrows the tree, keeping every match's ancestors.
   *
   * A filtered tree that dropped the parents would reparent the survivors:
   * "Safety data sheets" indented under nothing reads as a top-level page, and
   * the indent is the only thing saying where it lives. So a match pulls its
   * whole ancestry in with it, shown but not itself a result.
   *
   * The ancestry comes from the flattened list's own depths — a node at depth
   * d is the child of the last node seen at depth d-1 — so no second pass over
   * the nested pages is needed.
   */
  private applyFilters(): void {
    if (!this.filtersActive) {
      this.nodes = this.allNodes;
      return;
    }

    const needle = this.search.trim().toLowerCase();
    const keep = new Set<string>();
    const ancestors: FlatPageNode[] = [];

    for (const node of this.allNodes) {
      ancestors.length = node.depth;
      ancestors[node.depth] = node;

      if (!this.matches(node, needle)) continue;
      for (const ancestor of ancestors) {
        if (ancestor) keep.add(ancestor.page.uid);
      }
    }

    this.nodes = this.allNodes.filter(n => keep.has(n.page.uid));
  }

  private matches(node: FlatPageNode, needle: string): boolean {
    if (needle) {
      const haystack = [
        this.titleOf(node),
        node.page.slug,
        ...(node.page.translations || []).map(t => t.title)
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    switch (this.stateFilter) {
      case 'published':
        return this.isPublished(node);
      case 'draft':
        return !this.isPublished(node);
      case 'untranslated':
        return this.missingCount(node) > 0;
      default:
        return true;
    }
  }

  createPage(): void {
    this.router.navigate(['/admin/content/new']);
  }

  createChild(node: FlatPageNode): void {
    this.router.navigate(['/admin/content/new'], { queryParams: { parent: node.page.uid } });
  }

  editPage(node: FlatPageNode): void {
    this.router.navigate(['/admin/content', node.page.uid]);
  }

  // --- reordering among siblings --------------------------------------------

  /**
   * Reordering is off while a filter is on.
   *
   * The order sent is the whole sibling group renumbered, and a filtered table
   * shows only some of it. Dragging row 3 above row 1 when rows 2 and 4 are
   * hidden would silently renumber pages the editor cannot see — so the gesture
   * is withdrawn rather than made to guess.
   */
  get reorderEnabled(): boolean {
    return !this.filtersActive && !this.reordering;
  }

  /** Only siblings: a drag never changes a page's parent. Use Move for that. */
  canDropOn(node: FlatPageNode): boolean {
    return (
      !!this.dragging &&
      node.page.uid !== this.dragging.page.uid &&
      (node.page.parent_uid || '') === (this.dragging.page.parent_uid || '')
    );
  }

  onDragStart(node: FlatPageNode, event: DragEvent): void {
    if (!this.reorderEnabled) {
      event.preventDefault();
      return;
    }
    this.dragging = node;
    // Firefox starts no drag at all unless the payload is set, and the UID is
    // the smallest thing that identifies the row.
    event.dataTransfer?.setData('text/plain', node.page.uid);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(node: FlatPageNode, event: DragEvent): void {
    if (!this.canDropOn(node)) return;

    // Without preventDefault the browser treats the row as a non-target and
    // never fires drop.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const after = event.clientY > box.top + box.height / 2;

    // dragover fires continuously while the pointer moves. Re-rendering on each
    // one would run change detection over the whole tree for a picture that has
    // not changed, so only an actual move of the indicator is worth a pass.
    if (this.dropTarget === node && this.dropAfter === after) return;

    this.dropAfter = after;
    this.dropTarget = node;
    this.cdr.markForCheck();
  }

  onDragLeave(node: FlatPageNode): void {
    if (this.dropTarget === node) {
      this.dropTarget = null;
      this.cdr.markForCheck();
    }
  }

  onDragEnd(): void {
    this.dragging = null;
    this.dropTarget = null;
    this.cdr.markForCheck();
  }

  onDrop(node: FlatPageNode, event: DragEvent): void {
    if (!this.canDropOn(node)) return;
    event.preventDefault();

    const moved = this.dragging!;
    const after = this.dropAfter;
    this.onDragEnd();

    const siblings = this.siblingsOf(moved);
    const ordered = siblings.filter(n => n.page.uid !== moved.page.uid);
    const at = ordered.findIndex(n => n.page.uid === node.page.uid);
    if (at < 0) return;

    ordered.splice(after ? at + 1 : at, 0, moved);
    this.applyOrder(ordered);
  }

  /**
   * Keyboard equivalent of the drag, on the same handle.
   *
   * Alt rather than a bare arrow: the handle is a button in a table, and the
   * bare arrows belong to the browser's own row navigation.
   */
  onHandleKeydown(node: FlatPageNode, event: KeyboardEvent): void {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    this.nudge(node, event.key === 'ArrowUp' ? -1 : 1);
  }

  moveUp(node: FlatPageNode): void {
    this.nudge(node, -1);
  }

  moveDown(node: FlatPageNode): void {
    this.nudge(node, 1);
  }

  canMoveUp(node: FlatPageNode): boolean {
    return this.reorderEnabled && this.indexAmongSiblings(node) > 0;
  }

  canMoveDown(node: FlatPageNode): boolean {
    const siblings = this.siblingsOf(node);
    const at = siblings.findIndex(n => n.page.uid === node.page.uid);
    return this.reorderEnabled && at >= 0 && at < siblings.length - 1;
  }

  private indexAmongSiblings(node: FlatPageNode): number {
    return this.siblingsOf(node).findIndex(n => n.page.uid === node.page.uid);
  }

  private nudge(node: FlatPageNode, delta: number): void {
    if (!this.reorderEnabled) return;

    const siblings = this.siblingsOf(node);
    const at = siblings.findIndex(n => n.page.uid === node.page.uid);
    const to = at + delta;
    if (at < 0 || to < 0 || to >= siblings.length) return;

    const ordered = [...siblings];
    [ordered[at], ordered[to]] = [ordered[to], ordered[at]];
    this.applyOrder(ordered);
  }

  /**
   * A page's siblings in the order the table currently shows them.
   *
   * Read off `allNodes` rather than `nodes`: reordering is disabled while
   * filtered, so the two agree, and the unfiltered list is the one that defines
   * the group.
   */
  private siblingsOf(node: FlatPageNode): FlatPageNode[] {
    const parent = node.page.parent_uid || '';
    return this.allNodes.filter(n => (n.page.parent_uid || '') === parent);
  }

  /**
   * Writes a sibling group's new order.
   *
   * The whole group is renumbered from zero rather than only the rows that
   * shifted: sort_order values arrive from imports and hand edits with gaps and
   * ties in them, and a patch that assumed they were dense would reorder the
   * wrong rows.
   */
  private applyOrder(ordered: FlatPageNode[]): void {
    const moves: ContentPageReorder[] = ordered.map((n, i) => ({
      uid: n.page.uid,
      parent_uid: n.page.parent_uid || '',
      sort_order: i
    }));

    this.reordering = true;
    this.cdr.markForCheck();

    this.pages
      .reorderPages(moves)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.reordering = false;
          this.load();
        },
        error: err => {
          this.reordering = false;
          this.notifications.error(
            err?.error?.status_message || this.translation.instant('admin.content.reorderError')
          );
          // The rows on screen no longer match the server; re-read rather than
          // leaving the editor looking at an order that was refused.
          this.load();
        }
      });
  }

  // --- moving a page --------------------------------------------------------

  /**
   * Opens the move panel for one page.
   *
   * Every page in the tree is offered as a destination except the page itself
   * and everything below it — moving a branch inside its own branch detaches it
   * from the tree, which the server refuses anyway. Offering the choice and then
   * rejecting it would be the worse half of both.
   */
  openMove(node: FlatPageNode): void {
    this.movingNode = node;
    this.moveTarget = node.page.parent_uid || '';
    this.moveError = null;
    this.moveOptions = this.destinationsFor(node);
    this.cdr.markForCheck();
  }

  closeMove(): void {
    this.movingNode = null;
    this.moveError = null;
    this.cdr.markForCheck();
  }

  onMoveTargetChange(): void {
    this.moveError = null;
    this.cdr.markForCheck();
  }

  /**
   * The flat list minus the moved page's own subtree.
   *
   * `allNodes` is depth-first, so a page's descendants are exactly the rows
   * that follow it while the depth stays greater than its own.
   */
  private destinationsFor(node: FlatPageNode): MoveOption[] {
    const start = this.allNodes.indexOf(node);
    const excluded = new Set<string>([node.page.uid]);

    for (let i = start + 1; i < this.allNodes.length; i++) {
      if (this.allNodes[i].depth <= node.depth) break;
      excluded.add(this.allNodes[i].page.uid);
    }

    return this.allNodes
      .filter(n => !excluded.has(n.page.uid))
      .map(n => ({
        uid: n.page.uid,
        label: this.titleOf(n),
        path: n.page.path || n.page.slug,
        depth: n.depth
      }));
  }

  /** Where the page would answer once moved, so the change of address is visible. */
  get movePreviewPath(): string {
    if (!this.movingNode) return '';

    const slug = this.movingNode.page.slug;
    if (!this.moveTarget) return `/partners/${slug}`;

    const parent = this.moveOptions.find(o => o.uid === this.moveTarget);
    return parent ? `/partners/${parent.path}/${slug}` : `/partners/${slug}`;
  }

  get moveCurrentPath(): string {
    if (!this.movingNode) return '';
    return `/partners/${this.movingNode.page.path || this.movingNode.page.slug}`;
  }

  get moveChangesNothing(): boolean {
    return !!this.movingNode && (this.movingNode.page.parent_uid || '') === this.moveTarget;
  }

  /**
   * Whether a page at the destination already answers to this slug.
   *
   * The server checks this too and is the authority — this only spares the
   * editor a round trip to be told something the list on screen already knows.
   */
  get moveCollides(): boolean {
    if (!this.movingNode || this.moveChangesNothing) return false;

    return this.allNodes.some(
      n =>
        n.page.uid !== this.movingNode!.page.uid &&
        (n.page.parent_uid || '') === this.moveTarget &&
        n.page.slug === this.movingNode!.page.slug
    );
  }

  confirmMove(): void {
    if (!this.movingNode || this.moveChangesNothing || this.moveCollides) return;

    const move: ContentPageReorder = {
      uid: this.movingNode.page.uid,
      parent_uid: this.moveTarget,
      sort_order: this.nextSortOrder(this.moveTarget)
    };

    this.moving = true;
    this.pages
      .reorderPages([move])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.moving = false;
          this.movingNode = null;
          this.notifications.success(this.translation.instant('admin.content.moved'));
          this.load();
        },
        error: err => {
          this.moving = false;
          // The server refuses loops and slug collisions with a specific
          // reason; a generic failure would hide the fix.
          this.moveError =
            err?.error?.status_message || this.translation.instant('admin.content.moveError');
          this.cdr.markForCheck();
        }
      });
  }

  /** Last among its new siblings: a move is not also a claim about ordering. */
  private nextSortOrder(parentUid: string): number {
    const siblings = this.allNodes.filter(n => (n.page.parent_uid || '') === parentUid);
    return siblings.reduce((max, n) => Math.max(max, n.page.sort_order + 1), 0);
  }

  async deletePage(node: FlatPageNode): Promise<void> {
    const name = this.titleOf(node);
    const message = this.translation.instant('admin.content.deleteConfirm', { name });
    if (!(await this.confirmDialog.ask({ message, danger: true }))) return;

    this.pages
      .deletePages([node.page.uid])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.load(),
        error: err => {
          // The server refuses to orphan sub-pages; show its reason rather than
          // a generic failure, since the fix is specific.
          const message =
            err?.error?.status_message || this.translation.instant('admin.content.deleteError');
          this.notifications.error(message);
        }
      });
  }

  /**
   * Takes a page live, or off.
   *
   * Confirmed in both directions. This is one click on a row in a list — the
   * same gesture as opening a page — and it is the only control in the module
   * that changes what partners can see. Deleting has always asked; the action
   * that publishes a legal document to every partner should not be the quiet
   * one.
   */
  async togglePublish(node: FlatPageNode): Promise<void> {
    const publishing = node.page.status !== 'published';
    const message = this.translation.instant(
      publishing ? 'admin.content.publishConfirmNamed' : 'admin.content.unpublishConfirmNamed',
      { name: this.titleOf(node) }
    );
    if (!(await this.confirmDialog.ask({ message, danger: !publishing }))) return;

    const next = publishing ? 'published' : 'draft';

    this.pages
      .setStatus([{ uid: node.page.uid, status: next }])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.load(),
        error: err => {
          console.error('Failed to change publication:', err);
          this.notifications.error(this.translation.instant('admin.content.publishError'));
        }
      });
  }

  // --- display helpers ------------------------------------------------------

  titleOf(node: FlatPageNode): string {
    return this.pages.titleFor(node.page, this.displayLanguage);
  }

  /** Languages a page has been translated into, for the chip row. */
  translatedLanguages(node: FlatPageNode): string[] {
    return (node.page.translations || []).map(t => t.language.toUpperCase());
  }

  /**
   * Every registry language with whether this page has it.
   *
   * Listing only the translations that exist answers the cheap question. The
   * expensive one — which market is this page silently missing in — is only
   * answerable if the absent languages are on screen too, so they are.
   */
  languageStates(node: FlatPageNode): { code: string; has: boolean }[] {
    const have = new Set((node.page.translations || []).map(t => t.language));
    return this.languages.map(language => ({
      code: language.code.toUpperCase(),
      has: have.has(language.code)
    }));
  }

  /** How many registry languages this page is still missing. */
  missingCount(node: FlatPageNode): number {
    return this.languageStates(node).filter(s => !s.has).length;
  }

  /**
   * One-line audience summary. Four separate columns would read as four
   * unrelated settings; they are one decision with several axes.
   */
  audienceOf(node: FlatPageNode): string {
    const parts: string[] = [];
    if (node.page.countries?.length) parts.push(node.page.countries.join(', ').toUpperCase());
    if (node.page.languages?.length) parts.push(node.page.languages.join(', ').toUpperCase());
    if (node.page.store_uid) parts.push(this.translation.instant('admin.content.oneStore'));
    if (node.page.staff_only) parts.push(this.translation.instant('admin.content.staffOnly'));
    return parts.length ? parts.join(' · ') : '—';
  }

  /** Indent width for the tree column. */
  indentOf(node: FlatPageNode): string {
    return `${node.depth * 20}px`;
  }

  isPublished(node: FlatPageNode): boolean {
    return node.page.status === 'published';
  }

  trackByUid(_index: number, node: FlatPageNode): string {
    return node.page.uid;
  }
}
