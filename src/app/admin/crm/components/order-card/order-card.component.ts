import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CrmBoardOrder } from '../../models/crm-board.model';

@Component({
    selector: 'app-order-card',
    templateUrl: './order-card.component.html',
    styleUrls: ['./order-card.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderCardComponent {
  @Input() order!: CrmBoardOrder;
  @Input() stageColor: string = '#6366f1';

  @Output() openDetails = new EventEmitter<void>();

  onOpenDetailsClick(event: Event): void {
    event.stopPropagation();
    this.openDetails.emit();
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  formatPrice(amount: number, currencyCode: string): string {
    return (amount / 100).toLocaleString(undefined, {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: 2
    });
  }
}
