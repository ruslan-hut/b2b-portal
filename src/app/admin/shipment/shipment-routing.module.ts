import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SettingsComponent } from './settings/settings.component';
import { CarriersComponent } from './carriers/carriers.component';
import { CarrierEditComponent } from './carriers/carrier-edit/carrier-edit.component';
import { BoxesComponent } from './boxes/boxes.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'settings',
    pathMatch: 'full'
  },
  {
    path: 'settings',
    component: SettingsComponent,
    data: { title: 'Shipment Settings' }
  },
  {
    path: 'carriers',
    component: CarriersComponent,
    data: { title: 'Shipping Carriers' }
  },
  {
    path: 'carriers/new',
    component: CarrierEditComponent,
    data: { title: 'New Carrier' }
  },
  {
    path: 'carriers/:uid',
    component: CarrierEditComponent,
    data: { title: 'Edit Carrier' }
  },
  {
    path: 'boxes',
    component: BoxesComponent,
    data: { title: 'Boxes Configuration' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ShipmentRoutingModule { }
