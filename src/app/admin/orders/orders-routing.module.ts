import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrdersComponent } from './orders.component';
import { OrderDetailComponent } from './order-detail/order-detail.component';
import { OrderEditComponent } from './order-edit/order-edit.component';
import { OrderCreateComponent } from './order-create/order-create.component';
import { OrderAnalysisComponent } from './order-analysis/order-analysis.component';

// Static paths must stay ahead of ':id', which would otherwise swallow them.
const routes: Routes = [
  {
    path: '',
    component: OrdersComponent
  },
  {
    path: 'new',
    component: OrderCreateComponent
  },
  {
    path: 'analysis',
    component: OrderAnalysisComponent,
    data: { title: 'Order Analysis' }
  },
  {
    path: ':id',
    component: OrderDetailComponent
  },
  {
    path: ':id/edit',
    component: OrderEditComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrdersRoutingModule { }
