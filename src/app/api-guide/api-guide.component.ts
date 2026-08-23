import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslationService } from '../core/services/translation.service';
import { BrandingService } from '../core/services/branding.service';
import { clientApiBase } from './client-api-base';

/**
 * Client API guide: the step-by-step counterpart to the OpenAPI reference at
 * /api-docs. Public, like the reference — an integrator reads it before anyone
 * has issued them a key, and the profile page links here for clients who do not
 * have API access yet.
 *
 * The body exists once per language rather than as translation keys: it is a
 * document, not UI copy, and 400 lines of prose in a JSON file is not editable
 * by anyone who would want to edit it.
 */
@Component({
  selector: 'app-api-guide',
  templateUrl: './api-guide.component.html',
  styleUrls: ['./api-guide.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApiGuideComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  /** The configured portal name — this page is public, so it must not print a
      hardcoded one. Resolved by an app initializer before first render. */
  readonly siteName$ = inject(BrandingService).siteName$;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  /** 'uk' or 'en' — anything else reads the English document. */
  lang: 'uk' | 'en' = 'en';
  readonly base = clientApiBase();

  ngOnInit(): void {
    this.apply(this.translation.getCurrentLanguage());
    this.translation.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(l => { this.apply(l); this.cdr.markForCheck(); });
  }

  /** Reading the guide in the other language does not change the portal's UI language. */
  read(lang: 'uk' | 'en'): void {
    this.lang = lang;
    this.cdr.markForCheck();
  }

  private apply(language: string): void {
    this.lang = language === 'uk' ? 'uk' : 'en';
  }
}
