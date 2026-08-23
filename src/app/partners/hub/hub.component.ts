import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ContentPage } from '../../core/models/content-page.model';
import { AuthService } from '../../core/services/auth.service';
import { ContentPageService } from '../../core/services/content-page.service';
import { TranslationService } from '../../core/services/translation.service';
import { PageTitleService } from '../../core/services/page-title.service';
import { ClientService } from '../../core/services/client.service';

/**
 * Partner Resources landing.
 *
 * Card grid rather than a bare tree: it looks right on day one with little
 * content, mirrors what partners already know from the Notion original, and
 * works on mobile. Cards carry the domain's own vocabulary rather than a page
 * count, which answers a question nobody asked.
 */
@Component({
  selector: 'app-partners-hub',
  templateUrl: './hub.component.html',
  styleUrls: ['./hub.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HubComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  sections: ContentPage[] = [];
  loading = false;
  error: string | null = null;

  isStaff = false;
  /** Country codes resolved from the client's addresses. */
  markets: string[] = [];
  marketsLoaded = false;

  constructor(
    private content: ContentPageService,
    private auth: AuthService,
    private clients: ClientService,
    private translation: TranslationService,
    private pageTitle: PageTitleService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.pageTitle.setTitle(this.translation.instant('partners.title'));
    this.isStaff = this.auth.entityTypeValue === 'user';
    this.loadTree();
    if (!this.isStaff) {
      this.loadMarkets();
    }
  }

  private loadTree(): void {
    this.loading = true;
    this.error = null;

    this.content
      .getTree(this.translation.getCurrentLanguage(), this.isStaff)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: tree => {
          this.sections = tree;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to load partner content:', err);
          this.error = this.translation.instant('partners.loadError');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Country scope filters this hub silently. A partner cannot otherwise tell
   * "no document exists" from "one exists but not for you", which is dangerous
   * for regulatory material — so the resolved markets are stated up front with
   * a route to correct them.
   */
  private loadMarkets(): void {
    this.clients
      .getMyAddresses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: addresses => {
          const codes = new Set(
            (addresses || [])
              .map(a => (a.country_code || '').toUpperCase())
              .filter(Boolean)
          );
          this.markets = [...codes].sort();
          this.marketsLoaded = true;
          this.cdr.markForCheck();
        },
        // The band is informational; failing to load it must not block the hub.
        error: () => {
          this.marketsLoaded = true;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * The card subtitle: the names of what is inside, in the domain's own words.
   * Falls back to the page summary when it has one.
   */
  subtitleOf(section: ContentPage): string {
    if (section.summary) return section.summary;

    const childNames = (section.children || [])
      .slice(0, 3)
      .map(c => c.title)
      .filter(Boolean);
    return childNames.join(' · ');
  }

  childCount(section: ContentPage): number {
    return (section.children || []).length;
  }

  isDraft(section: ContentPage): boolean {
    return section.status !== 'published';
  }

  iconOf(section: ContentPage): string {
    return section.icon || 'description';
  }

  /** Where a section lives: the full slug chain, not the slug alone. */
  linkFor(section: ContentPage): string {
    return this.content.partnerLink(section);
  }

  trackByUid(_index: number, page: ContentPage): string {
    return page.uid;
  }
}
