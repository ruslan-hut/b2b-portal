import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-order-confirmation-dialog',
    templateUrl: './order-confirmation-dialog.component.html',
    styleUrl: './order-confirmation-dialog.component.scss',
    standalone: false
})
export class OrderConfirmationDialogComponent {
  @Input() total: number = 0;
  @Input() currencyName: string | undefined = undefined;
  @Input() isConfirming: boolean = false; // Loading state when creating order
  @Input() isSuccess: boolean = false; // Show success message after order is created
  @Output() closed = new EventEmitter<void>();

  onClose(): void {
    this.closed.emit();
  }
}
