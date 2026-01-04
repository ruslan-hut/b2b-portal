import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ClientsRoutingModule } from './clients-routing.module';
import { ClientsComponent } from './clients.component';
import { ClientEditComponent } from './client-edit/client-edit.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    ClientsComponent,
    ClientEditComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ClientsRoutingModule,
    SharedModule
  ]
})
export class ClientsModule { }

