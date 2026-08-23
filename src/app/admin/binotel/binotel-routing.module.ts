import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BinotelComponent } from './binotel.component';

const routes: Routes = [
  {
    path: '',
    component: BinotelComponent,
    data: { title: 'Telephony Settings' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BinotelRoutingModule { }
