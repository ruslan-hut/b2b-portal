import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Maintenance } from '../../services/maintenance';

@Component({
  selector: 'app-maintenance-banner',
  templateUrl: './maintenance-banner.component.html',
  styleUrl: './maintenance-banner.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MaintenanceBannerComponent {
  protected readonly maintenance = inject(Maintenance);
}
