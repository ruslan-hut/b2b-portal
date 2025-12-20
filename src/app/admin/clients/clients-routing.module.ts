import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientsComponent } from './clients.component';
import { ClientEditComponent } from './client-edit/client-edit.component';

const routes: Routes = [
  {
    path: '',
    component: ClientsComponent
  },
  {
    path: 'new',
    component: ClientEditComponent
  },
  {
    path: ':uid',
    component: ClientEditComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientsRoutingModule { }

