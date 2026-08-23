import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CrmBoardColumn, CrmBoardOrder } from '../../models/crm-board.model';
import { CrmTransition } from '../../models/crm-stage.model';

@Component({
  selector: 'app-pipeline-board',
  templateUrl: './pipeline-board.component.html',
  styleUrls: ['./pipeline-board.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PipelineBoardComponent {
  readonly columns = input<CrmBoardColumn[]>([]);
  readonly transitions = input<CrmTransition[]>([]);
  readonly changedOrderUids = input<Set<string>>(new Set());

  readonly orderMoved = output<{ orderUid: string; fromStageUid: string; toStageUid: string }>();
  readonly viewOrder = output<CrmBoardOrder>();
  readonly openOrderDetails = output<CrmBoardOrder>();

  getConnectedDropLists(): string[] {
    return this.columns().map((_, index) => `column-${index}`);
  }

  canDrop(fromStageUid: string, toStageUid: string): boolean {
    if (fromStageUid === toStageUid) {
      return true;
    }
    return this.transitions().some(t =>
      t.from_stage_uid === fromStageUid && t.to_stage_uid === toStageUid
    );
  }

  onDrop(event: CdkDragDrop<{ orders: CrmBoardOrder[]; stageUid: string }>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data.orders,
        event.previousIndex,
        event.currentIndex
      );
      return;
    }

    const fromStageUid = event.previousContainer.data.stageUid;
    const toStageUid = event.container.data.stageUid;

    if (!this.canDrop(fromStageUid, toStageUid)) {
      return;
    }

    const order = event.previousContainer.data.orders[event.previousIndex];

    transferArrayItem(
      event.previousContainer.data.orders,
      event.container.data.orders,
      event.previousIndex,
      event.currentIndex
    );

    this.orderMoved.emit({
      orderUid: order.uid,
      fromStageUid,
      toStageUid
    });
  }

  onViewClick(order: CrmBoardOrder): void {
    this.viewOrder.emit(order);
  }

  onOpenDetailsClick(order: CrmBoardOrder): void {
    this.openOrderDetails.emit(order);
  }

  getColumnData(column: CrmBoardColumn): { orders: CrmBoardOrder[]; stageUid: string } {
    return {
      orders: column.orders,
      stageUid: column.stage.uid
    };
  }
}
