import { ChangeDetectionStrategy, Component } from '@angular/core';
import { clientApiBase } from '../client-api-base';

/** The guide, in English. Same document as ApiGuideUkComponent, same stylesheet. */
@Component({
  selector: 'app-api-guide-en',
  templateUrl: './api-guide-en.component.html',
  styleUrls: ['./api-guide-content.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApiGuideEnComponent {
  readonly base = clientApiBase();
}
