import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ContentBlock, ContentPage } from '../../core/models/content-page.model';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ContentPageService } from '../../core/services/content-page.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageTitleService } from '../../core/services/page-title.service';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-partner-page',
  templateUrl: './page.component.html',
  styleUrls: ['./page.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PartnerPageComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  page: ContentPage | null = null;
  tree: ContentPage[] = [];
  breadcrumbs: ContentPage[] = [];

  loading = false;
  notFound = false;
  error: string | null = null;
  isStaff = false;
  /** Mobile "Contents" sheet. */
  showContents = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private content: ContentPageService,
    private auth: AuthService,
    private translation: TranslationService,
    private pageTitle: PageTitleService,
    private confirmDialog: ConfirmDialogService,
    private notifications: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isStaff = this.auth.entityTypeValue === 'user';
    this.loadTree();

    // url rather than paramMap: the route is a wildcard, so the address arrives
    // as segments and not as a named parameter.
    this.route.url
      .pipe(
        switchMap(segments => {
          this.loading = true;
          this.notFound = false;
          this.error = null;
          this.showContents = false;
          this.cdr.markForCheck();
          return this.content.getPageByPath(
            segments.map(s => s.path).join('/'),
            this.translation.getCurrentLanguage(),
            this.isStaff
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: page => {
          this.page = page;
          this.pageTitle.setTitle(page.title || this.translation.instant('partners.title'));
          this.rebuildBreadcrumbs();
          this.loading = false;
          this.canonicalizeUrl(page);
          this.cdr.markForCheck();
        },
        error: err => {
          this.loading = false;
          // A page hidden from this viewer 404s exactly as a missing one does,
          // so both land here and neither reveals which it was.
          if (err?.status === 404) {
            this.notFound = true;
          } else {
            console.error('Failed to load partner page:', err);
            this.error = this.translation.instant('partners.loadError');
          }
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Rewrites the address bar when the page was reached by an old flat link.
   *
   * The backend still resolves a bare slug when exactly one page carries it, so
   * links handed out before pages had paths keep working. replaceUrl so the
   * stale address does not become a back-button stop of its own.
   */
  private canonicalizeUrl(page: ContentPage): void {
    if (!page.path) return;

    const current = this.route.snapshot.url.map(s => s.path).join('/');
    if (current === page.path) return;

    this.router.navigate(['/partners', ...page.path.split('/')], { replaceUrl: true });
  }

  private loadTree(): void {
    this.content
      .getTree(this.translation.getCurrentLanguage(), this.isStaff)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: tree => {
          this.tree = tree;
          this.rebuildBreadcrumbs();
          this.cdr.markForCheck();
        },
        error: err => console.error('Failed to load partner tree:', err)
      });
  }

  /** Walks the tree to the current page so the trail can be rendered. */
  private rebuildBreadcrumbs(): void {
    if (!this.page || !this.tree.length) return;

    const path: ContentPage[] = [];
    const walk = (nodes: ContentPage[], trail: ContentPage[]): boolean => {
      for (const node of nodes) {
        const next = [...trail, node];
        if (node.uid === this.page!.uid) {
          path.push(...next);
          return true;
        }
        if (walk(node.children || [], next)) return true;
      }
      return false;
    };

    walk(this.tree, []);
    this.breadcrumbs = path;
  }

  /** The top-level section the current page sits under, for the sidebar. */
  get sectionRoot(): ContentPage | null {
    return this.breadcrumbs[0] || null;
  }

  isCurrent(node: ContentPage): boolean {
    return node.uid === this.page?.uid;
  }

  isDraft(node: ContentPage): boolean {
    return node.status !== 'published';
  }

  toggleContents(): void {
    this.showContents = !this.showContents;
    this.cdr.markForCheck();
  }

  /** Blocks arrive with a server-resolved `payload`; the renderer takes them as is. */
  get blocks(): ContentBlock[] {
    return this.page?.blocks || [];
  }

  // --- staff bar ------------------------------------------------------------

  get canEdit(): boolean {
    return !!this.page?.can_edit;
  }

  /** Where a tree node lives, for every link this page renders. */
  linkFor(node: ContentPage): string {
    return this.content.partnerLink(node);
  }

  editInAdmin(): void {
    if (this.page) {
      this.router.navigate(['/admin/content', this.page.uid]);
    }
  }

  /**
   * Publishing is immediate; unpublishing asks first, because it withdraws
   * material partners may already be linking to.
   */
  async togglePublish(): Promise<void> {
    if (!this.page) return;

    const publishing = this.page.status !== 'published';
    if (!publishing) {
      const message = this.translation.instant('partners.unpublishConfirm');
      if (!(await this.confirmDialog.ask({ message, danger: true }))) return;
    }

    this.content
      .setStatus([{ uid: this.page.uid, status: publishing ? 'published' : 'draft' }])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.page = { ...this.page!, status: publishing ? 'published' : 'draft' };
          this.notifications.success(
            this.translation.instant(publishing ? 'partners.published' : 'partners.unpublished')
          );
          this.loadTree();
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to change publication:', err);
          this.notifications.error(this.translation.instant('partners.publishError'));
        }
      });
  }

  /** Audience summary shown to staff, so targeting is legible from the page. */
  audienceOf(page: ContentPage): string {
    const parts: string[] = [];
    if (page.countries?.length) parts.push(page.countries.join(', ').toUpperCase());
    if (page.languages?.length) parts.push(page.languages.join(', ').toUpperCase());
    if (page.staff_only) parts.push(this.translation.instant('partners.staffOnly'));
    return parts.join(' · ');
  }

  trackByUid(_index: number, page: ContentPage): string {
    return page.uid;
  }
}
