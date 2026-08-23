import { ApplicationRef, DestroyRef, Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { BehaviorSubject, Observable, concat, fromEvent, interval, merge, of, timer } from 'rxjs';
import { filter, first, switchMap } from 'rxjs/operators';

export interface AppUpdateConfig {
  /** How often a long-lived tab re-asks the server for a new app version. */
  pollMs: number;
  /** How long "Later" hides the banner before it offers the update again. */
  snoozeMs: number;
}

export const DEFAULT_APP_UPDATE_CONFIG: AppUpdateConfig = {
  pollMs: 30 * 60 * 1000,
  snoozeMs: 30 * 60 * 1000
};

export const APP_UPDATE_CONFIG = new InjectionToken<AppUpdateConfig>('APP_UPDATE_CONFIG');

/**
 * Owns the service-worker update lifecycle.
 *
 * The service worker only learns about a new release when something asks it to
 * look. A one-shot check at startup left tabs that stay open for days pinned to
 * the bundle they booted with — that is how clients kept calling endpoints a
 * deploy had already removed. So we re-check on a timer and whenever the tab is
 * brought back to the foreground, and "Later" only snoozes the prompt rather
 * than silencing it for the life of the tab.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly updateAvailable = new BehaviorSubject<boolean>(false);
  readonly updateAvailable$: Observable<boolean> = this.updateAvailable.asObservable();

  private readonly config: AppUpdateConfig;
  /** A new version is installed and waiting, regardless of banner visibility. */
  private pending = false;
  /** Epoch ms before which the banner stays hidden; 0 once the snooze lapses. */
  private snoozedUntil = 0;
  private started = false;

  constructor(
    private readonly swUpdate: SwUpdate,
    private readonly appRef: ApplicationRef,
    private readonly destroyRef: DestroyRef,
    @Optional() @Inject(APP_UPDATE_CONFIG) config: AppUpdateConfig | null
  ) {
    this.config = config ?? DEFAULT_APP_UPDATE_CONFIG;
  }

  /** Idempotent; safe to call from whichever component mounts first. */
  start(): void {
    if (this.started || !this.swUpdate.isEnabled) {
      return;
    }
    this.started = true;

    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.pending = true;
        this.offerUpdate();
      });

    // The cached bundle is gone and the running app can no longer fetch its own
    // lazy chunks. Nothing the user does will recover it; reload immediately.
    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());

    // Polling before the app reports stable would keep it permanently unstable,
    // and `registerWhenStable` would never fire. Wait, then check on a timer and
    // on every return to the foreground — the latter catches the tab that sat in
    // a background window across a deploy.
    const appStable$ = this.appRef.isStable.pipe(first(stable => stable));

    concat(appStable$, merge(interval(this.config.pollMs), this.tabForegrounded$()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.checkForUpdate());
  }

  /** Applies the waiting version. Falls back to a plain reload if none is. */
  reload(): void {
    if (!this.swUpdate.isEnabled) {
      this.hardReload();
      return;
    }
    this.swUpdate
      .activateUpdate()
      .then(() => this.hardReload())
      .catch(() => this.hardReload());
  }

  /**
   * Hides the banner for `snoozeMs`, then offers the update again if it is still
   * waiting. Dismissal must never be permanent: a client that clicks "Later"
   * once would otherwise run the stale bundle until the tab is closed.
   */
  dismiss(): void {
    this.snoozedUntil = Date.now() + this.config.snoozeMs;
    this.updateAvailable.next(false);
    timer(this.config.snoozeMs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.snoozedUntil = 0;
        this.offerUpdate();
      });
  }

  /** Shows the banner unless the user asked for quiet, and there is news. */
  private offerUpdate(): void {
    if (this.pending && Date.now() >= this.snoozedUntil) {
      this.updateAvailable.next(true);
    }
  }

  private tabForegrounded$(): Observable<unknown> {
    if (typeof document === 'undefined') {
      return of();
    }
    return fromEvent(document, 'visibilitychange').pipe(
      filter(() => document.visibilityState === 'visible')
    );
  }

  private async checkForUpdate(): Promise<void> {
    // A version already waiting means there is nothing new to fetch; just make
    // sure the user is still being told about it.
    if (this.pending) {
      this.offerUpdate();
      return;
    }
    try {
      await this.swUpdate.checkForUpdate();
    } catch {
      // Offline, or the worker is not ready yet. The next tick retries.
    }
  }

  private hardReload(): void {
    window.location.reload();
  }
}
