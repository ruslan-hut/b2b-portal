import { Component, OnInit, OnDestroy } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, map } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-update-notification',
    templateUrl: './update-notification.component.html',
    styleUrl: './update-notification.component.scss',
    standalone: false
})
export class UpdateNotificationComponent implements OnInit, OnDestroy {
  updateAvailable = false;
  private subscriptions = new Subscription();

  constructor(private swUpdate: SwUpdate) {}

  /**
   * Initialize component and check for service worker updates
   */
  ngOnInit(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    // Check for updates
    this.swUpdate.checkForUpdate();

    // Listen for version ready event
    const versionReady$ = this.swUpdate.versionUpdates.pipe(
      filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
      map(() => true)
    );

    this.subscriptions.add(
      versionReady$.subscribe(() => {
        this.updateAvailable = true;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Reload the application with the new version
   */
  reloadApp(): void {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.activateUpdate().then(() => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  }

  /**
   * Dismiss the update notification
   */
  dismiss(): void {
    this.updateAvailable = false;
  }
}

