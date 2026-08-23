import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdersRoutingModule } from './orders-routing.module';
import { OrdersComponent } from './orders.component';
import { SharedModule } from '../../shared/shared.module';
import { OrderDetailComponent } from './order-detail/order-detail.component';
import { OrderEditComponent } from './order-edit/order-edit.component';
import { OrderCreateComponent } from './order-create/order-create.component';
import { OrderAnalysisComponent } from './order-analysis/order-analysis.component';
import { OrderSplitDialog } from './order-split/order-split-dialog';

@NgModule({
  declarations: [
    OrdersComponent,
    OrderDetailComponent,
    OrderEditComponent,
    OrderCreateComponent,
    OrderAnalysisComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    OrdersRoutingModule,
    SharedModule,
    OrderSplitDialog
  ]
})
export class OrdersModule { }

