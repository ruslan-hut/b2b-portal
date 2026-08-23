import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Presentational component for the floating "Scroll to Top" button shown on the
 * catalog. (Page navigation is handled by the shared app-pagination component.)
 */
@Component({
  selector: 'app-pagination-controls',
  standalone: false,
  templateUrl: './pagination-controls.component.html',
  styleUrl: './pagination-controls.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaginationControlsComponent {
  readonly showScrollToTop = input<boolean>(false);

  readonly scrollToTop = output<void>();

  onScrollToTopClick(): void {
    this.scrollToTop.emit();
  }
}
