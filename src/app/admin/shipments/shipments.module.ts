import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShipmentsRoutingModule } from './shipments-routing.module';
import { ShipmentsComponent } from './shipments.component';
import { ListComponent } from './list/list.component';
import { EventsComponent } from './events/events.component';
import { PickupsComponent } from './pickups/pickups.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    ShipmentsComponent,
    ListComponent,
    PickupsComponent,
    EventsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ShipmentsRoutingModule,
    SharedModule
  ]
})
export class ShipmentsModule { }
