import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { readToken } from '../core/utils/theme-token';
import { BrandingService } from '../core/services/branding.service';

declare const Redoc: any;

/**
 * Client API reference: renders the OpenAPI document the backend serves with
 * a self-hosted Redoc bundle (copied from node_modules at build time — no CDN,
 * the portal must not depend on third-party hosts).
 */
@Component({
  selector: 'app-api-docs',
  templateUrl: './api-docs.component.html',
  styleUrls: ['./api-docs.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApiDocsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('redoc', { static: true }) container!: ElementRef<HTMLDivElement>;
  /** Same reason as the guide: a public page must not print a hardcoded name. */
  readonly siteName$ = inject(BrandingService).siteName$;
  error: string | null = null;
  loading = true;
  readonly specUrl = environment.apiUrl.replace(/\/api\/v1\/?$/, '') + '/api/client/v1/openapi.yaml';
  private script: HTMLScriptElement | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    if (typeof Redoc !== 'undefined') { this.render(); return; }
    this.script = document.createElement('script');
    this.script.src = 'assets/redoc/redoc.standalone.js';
    this.script.async = true;
    this.script.onload = () => this.render();
    this.script.onerror = () => { this.loading = false; this.error = 'Failed to load the documentation renderer.'; this.cdr.markForCheck(); };
    document.body.appendChild(this.script);
  }

  private render(): void {
    Redoc.init(this.specUrl, {
      hideDownloadButton: false,
      expandResponses: '200,201',
      // ReDoc wants a resolved colour, not a var() reference, so read the
      // token off the document rather than hardcoding a second brand hue.
      theme: { colors: { primary: { main: readToken('--color-primary', '#5b5fc7') } }, typography: { fontFamily: 'inherit' } }
    }, this.container.nativeElement, (err: any) => {
      this.loading = false;
      if (err) { this.error = String(err?.message || err); }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void { /* the script stays cached; Redoc has no teardown */ }
}
