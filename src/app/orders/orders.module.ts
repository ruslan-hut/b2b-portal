import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { OrdersRoutingModule } from './orders-routing.module';
import { OrderHistoryComponent } from './order-history/order-history.component';
import { CoreModule } from '../core/core.module';


@NgModule({
  declarations: [
    OrderHistoryComponent
  ],
  imports: [
    CommonModule,
    OrdersRoutingModule,
    CoreModule
  ]
})
export class OrdersModule { }
