import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CrmBoardOrder } from '../../models/crm-board.model';
import { formatDate } from '../../../../core/utils/date-format';
import { PriceFormattingService } from '../../../../core/services/price-formatting.service';

@Component({
  selector: 'app-order-card',
  templateUrl: './order-card.component.html',
  styleUrls: ['./order-card.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderCardComponent {
  private readonly priceFormatting = inject(PriceFormattingService);

  readonly order = input.required<CrmBoardOrder>();
  readonly stageColor = input<string>('#6366f1');
  readonly highlight = input<boolean>(false);

  readonly openDetails = output<void>();

  onOpenDetailsClick(event: Event): void {
    event.stopPropagation();
    this.openDetails.emit();
  }

  formatOrderDate(dateString: string): string {
    return formatDate(dateString);
  }

  formatPrice(amount: number, currencyCode: string): string {
    return this.priceFormatting.formatPriceWithCurrency(amount, currencyCode);
  }
}
