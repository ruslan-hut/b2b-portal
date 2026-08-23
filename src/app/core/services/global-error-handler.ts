import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

/**
 * Global handler for otherwise-uncaught runtime errors (template bindings,
 * change detection, unhandled promise rejections). Without one, such an error
 * escapes the Angular zone and can leave the UI frozen with no diagnostics.
 *
 * Responsibilities:
 *  - Swallow HttpErrorResponse: those are surfaced per-request by the auth
 *    interceptor and component error handlers; re-logging here is just noise.
 *  - Detect chunk-load failures (stale lazy chunks after a new deploy) and
 *    reload once so the user transparently gets the new bundle.
 *  - Centralize logging as the single place to later forward to telemetry.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly zone = inject(NgZone);
  private reloadingForChunk = false;

  handleError(error: unknown): void {
    // Unwrap promise-rejection wrapper used by zone.js.
    const err = (error as { rejection?: unknown })?.rejection ?? error;

    if (err instanceof HttpErrorResponse) {
      return;
    }

    const message = (err as { message?: string })?.message ?? String(err);

    // A lazy chunk failed to load — almost always a client holding a stale
    // index against freshly-hashed bundles after a deploy. Reload once.
    if (/ChunkLoadError|Loading chunk [^\s]+ failed/i.test(message)) {
      if (!this.reloadingForChunk) {
        this.reloadingForChunk = true;
        console.error('Lazy chunk failed to load (stale build after deploy); reloading.', err);
        this.zone.runOutsideAngular(() => window.location.reload());
      }
      return;
    }

    console.error('Unhandled application error:', err);
    // TODO: forward to telemetry / show a user-facing toast once a shared
    // notification service exists.
  }
}
