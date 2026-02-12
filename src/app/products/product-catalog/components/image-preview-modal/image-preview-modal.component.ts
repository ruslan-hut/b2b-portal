import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener } from '@angular/core';

/**
 * Presentational component for full-screen image preview modal
 * Displays product image in a modal overlay with close functionality
 */
@Component({
  selector: 'app-image-preview-modal',
  standalone: false,
  templateUrl: './image-preview-modal.component.html',
  styleUrl: './image-preview-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImagePreviewModalComponent {
  /**
   * URL of the image to preview
   */
  @Input({ required: true }) imageUrl!: string;

  /**
   * Alt text for the image (product name)
   */
  @Input({ required: true }) altText!: string;

  /**
   * Emitted when modal should be closed
   */
  @Output() closed = new EventEmitter<void>();

  /**
   * Close modal when backdrop is clicked
   */
  onBackdropClick(): void {
    this.closed.emit();
  }

  /**
   * Close modal when close button is clicked
   */
  onCloseClick(): void {
    this.closed.emit();
  }

  /**
   * Close modal when ESC key is pressed
   */
  @HostListener('document:keydown.escape')
  onEscKey(): void {
    this.closed.emit();
  }

  /**
   * Handle image load errors by setting a placeholder image
   */
  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/product-placeholder.svg';
  }
}
