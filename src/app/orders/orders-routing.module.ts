import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrderHistoryComponent } from './order-history/order-history.component';
import { OrderDetailComponent } from './order-detail/order-detail.component';

const routes: Routes = [
  {
    path: 'history',
    component: OrderHistoryComponent,
    data: { title: 'orders.title' }
  },
  {
    path: 'detail/:id',
    component: OrderDetailComponent,
    data: { title: 'orders.orderDetails' }
  },
  {
    path: '',
    redirectTo: 'history',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrdersRoutingModule { }
