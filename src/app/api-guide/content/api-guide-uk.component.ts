import { ChangeDetectionStrategy, Component } from '@angular/core';
import { clientApiBase } from '../client-api-base';

/** The guide, in Ukrainian. Content only — the chrome lives in ApiGuideComponent. */
@Component({
  selector: 'app-api-guide-uk',
  templateUrl: './api-guide-uk.component.html',
  styleUrls: ['./api-guide-content.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApiGuideUkComponent {
  readonly base = clientApiBase();
}
