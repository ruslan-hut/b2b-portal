import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { OrderErrorDetail, OrderProblem } from '../../core/services/error-handler.service';

@Component({
    selector: 'app-order-error-dialog',
    templateUrl: './order-error-dialog.component.html',
    styleUrl: './order-error-dialog.component.scss',
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderErrorDialogComponent {
  @Input() detail: OrderErrorDetail | null = null;
  @Input() canShowProblems: boolean = false;

  @Output() closed = new EventEmitter<void>();
  @Output() showProblems = new EventEmitter<void>();

  readonly previewLimit = 3;

  get visibleProblems(): OrderProblem[] {
    return (this.detail?.problems ?? []).slice(0, this.previewLimit);
  }

  get extraCount(): number {
    const total = this.detail?.problems.length ?? 0;
    return Math.max(0, total - this.previewLimit);
  }

  get hasProblems(): boolean {
    return (this.detail?.problems.length ?? 0) > 0;
  }

  onClose(): void {
    this.closed.emit();
  }

  onShowProblems(): void {
    this.showProblems.emit();
  }
}
