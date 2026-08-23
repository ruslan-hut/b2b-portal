import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppUpdateService } from '../../services/app-update.service';

@Component({
    selector: 'app-update-notification',
    templateUrl: './update-notification.component.html',
    styleUrl: './update-notification.component.scss',
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateNotificationComponent implements OnInit {
  updateAvailable = false;

  constructor(
    private appUpdate: AppUpdateService,
    private cdr: ChangeDetectorRef,
    private destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.appUpdate.start();

    this.appUpdate.updateAvailable$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(available => {
        this.updateAvailable = available;
        this.cdr.markForCheck();
      });
  }

  /** Reload the application with the new version */
  reloadApp(): void {
    this.appUpdate.reload();
  }

  /** Hide the banner; the service will offer the update again later. */
  dismiss(): void {
    this.appUpdate.dismiss();
  }
}
