import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Presentational component for full-screen image preview modal
 * Displays product image in a modal overlay with close functionality
 */
@Component({
  selector: 'app-image-preview-modal',
  standalone: false,
  templateUrl: './image-preview-modal.component.html',
  styleUrl: './image-preview-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscKey()'
  }
})
export class ImagePreviewModalComponent {
  readonly imageUrl = input.required<string>();
  readonly altText = input.required<string>();
  readonly closed = output<void>();

  onBackdropClick(): void {
    this.closed.emit();
  }

  onCloseClick(): void {
    this.closed.emit();
  }

  onEscKey(): void {
    this.closed.emit();
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/product-placeholder.svg';
  }
}
