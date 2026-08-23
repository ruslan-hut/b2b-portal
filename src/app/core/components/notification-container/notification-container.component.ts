import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NotificationService, AppNotification, NotificationType } from '../../services/notification.service';

/**
 * Renders the stack of active toast notifications. Mount once at the app root.
 * Reads state from NotificationService via the async pipe (OnPush-friendly).
 */
@Component({
  selector: 'app-notification-container',
  templateUrl: './notification-container.component.html',
  styleUrl: './notification-container.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationContainerComponent {
  constructor(public notifications: NotificationService) {}

  iconFor(type: NotificationType): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }

  trackById(_index: number, n: AppNotification): number {
    return n.id;
  }
}
