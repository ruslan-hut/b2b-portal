import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ShipmentRoutingModule } from './shipment-routing.module';
import { SettingsComponent } from './settings/settings.component';
import { CarriersComponent } from './carriers/carriers.component';
import { BoxesComponent } from './boxes/boxes.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    SettingsComponent,
    CarriersComponent,
    BoxesComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ShipmentRoutingModule,
    SharedModule
  ]
})
export class ShipmentModule { }
