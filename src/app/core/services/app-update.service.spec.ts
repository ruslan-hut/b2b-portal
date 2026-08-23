import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { Subject, of } from 'rxjs';
import { AppUpdateService, APP_UPDATE_CONFIG } from './app-update.service';

describe('AppUpdateService', () => {
  let versionUpdates: Subject<any>;
  let unrecoverable: Subject<any>;
  let checks: number;
  let swUpdate: any;

  const POLL_MS = 1000;
  const SNOOZE_MS = 2000;

  function setup(isEnabled = true): AppUpdateService {
    versionUpdates = new Subject<any>();
    unrecoverable = new Subject<any>();
    checks = 0;
    swUpdate = {
      isEnabled,
      versionUpdates,
      unrecoverable,
      checkForUpdate: () => { checks++; return Promise.resolve(false); },
      activateUpdate: () => Promise.resolve(true)
    };

    TestBed.configureTestingModule({
      providers: [
        AppUpdateService,
        { provide: SwUpdate, useValue: swUpdate },
        { provide: APP_UPDATE_CONFIG, useValue: { pollMs: POLL_MS, snoozeMs: SNOOZE_MS } }
      ]
    });

    // Replacing the ApplicationRef provider outright breaks Angular's own
    // change-detection scheduler, which injects it. Stub just the one member
    // the service reads, on the real instance.
    const appRef = TestBed.inject(ApplicationRef);
    Object.defineProperty(appRef, 'isStable', { value: of(true), configurable: true });

    return TestBed.inject(AppUpdateService);
  }

  function latest(service: AppUpdateService): boolean {
    let value = false;
    service.updateAvailable$.subscribe(v => (value = v)).unsubscribe();
    return value;
  }

  // The reported bug: a tab open across a deploy checked once at boot and never
  // again, so it kept running the bundle it started with.
  it('keeps polling for new versions in a long-lived tab', fakeAsync(() => {
    const service = setup();
    service.start();
    tick(0);
    expect(checks).toBe(1);

    tick(POLL_MS * 3);
    expect(checks).toBeGreaterThanOrEqual(4);

    discardPeriodicTasks();
  }));

  it('re-checks when the tab returns to the foreground', fakeAsync(() => {
    const service = setup();
    service.start();
    tick(0);
    const before = checks;

    document.dispatchEvent(new Event('visibilitychange'));
    tick(0);

    expect(checks).toBe(before + 1);
    discardPeriodicTasks();
  }));

  it('shows the banner when a version is ready', fakeAsync(() => {
    const service = setup();
    service.start();
    versionUpdates.next({ type: 'VERSION_READY' });

    expect(latest(service)).toBe(true);
    discardPeriodicTasks();
  }));

  // The second half of the bug: "Later" hid the banner for the life of the tab.
  it('re-offers the update after the snooze lapses', fakeAsync(() => {
    const service = setup();
    service.start();
    versionUpdates.next({ type: 'VERSION_READY' });

    service.dismiss();
    expect(latest(service)).toBe(false);

    tick(SNOOZE_MS);
    expect(latest(service)).toBe(true);

    discardPeriodicTasks();
  }));

  it('keeps a snoozed banner hidden when the tab is refocused', fakeAsync(() => {
    const service = setup();
    service.start();
    versionUpdates.next({ type: 'VERSION_READY' });
    service.dismiss();

    document.dispatchEvent(new Event('visibilitychange'));
    tick(0);

    expect(latest(service)).toBe(false);
    discardPeriodicTasks();
  }));

  it('does nothing when the service worker is disabled', fakeAsync(() => {
    const service = setup(false);
    service.start();
    tick(POLL_MS * 2);

    expect(checks).toBe(0);
    discardPeriodicTasks();
  }));

  it('does not stack pollers when start is called repeatedly', fakeAsync(() => {
    const service = setup();
    service.start();
    service.start();
    tick(0);

    expect(checks).toBe(1);
    discardPeriodicTasks();
  }));
});
