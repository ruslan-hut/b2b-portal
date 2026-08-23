import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ShipmentsComponent } from './shipments.component';
import { ListComponent } from './list/list.component';
import { EventsComponent } from './events/events.component';
import { PickupsComponent } from './pickups/pickups.component';

const routes: Routes = [
  {
    path: '',
    component: ShipmentsComponent,
    children: [
      { path: '', redirectTo: 'list', pathMatch: 'full' },
      { path: 'list', component: ListComponent, data: { title: 'Shipments' } },
      { path: 'pickups', component: PickupsComponent, data: { title: 'Courier Pickups' } },
      { path: 'events', component: EventsComponent, data: { title: 'Shipment Events' } }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ShipmentsRoutingModule { }
