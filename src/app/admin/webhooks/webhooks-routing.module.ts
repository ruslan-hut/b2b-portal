import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WebhooksComponent } from './webhooks.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'webhooks',
    pathMatch: 'full'
  },
  {
    path: 'webhooks',
    component: WebhooksComponent
  },
  {
    path: 'deliveries',
    component: WebhooksComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class WebhooksRoutingModule { }
