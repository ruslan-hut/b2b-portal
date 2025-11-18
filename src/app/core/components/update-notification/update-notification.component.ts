import { Component, OnInit, OnDestroy } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, map, Subscription } from 'rxjs';

@Component({
  selector: 'app-update-notification',
  templateUrl: './update-notification.component.html',
  styleUrls: ['./update-notification.component.scss']
})
export class UpdateNotificationComponent implements OnInit, OnDestroy {
  updateAvailable = false;
  private subscriptions = new Subscription();

  constructor(private swUpdate: SwUpdate) {}

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

  reloadApp(): void {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.activateUpdate().then(() => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  }

  dismiss(): void {
    this.updateAvailable = false;
  }
}

