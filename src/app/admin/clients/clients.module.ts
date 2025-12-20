import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ClientsRoutingModule } from './clients-routing.module';
import { ClientsComponent } from './clients.component';
import { ClientEditComponent } from './client-edit/client-edit.component';
import { CoreModule } from '../../core/core.module';

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
    CoreModule
  ]
})
export class ClientsModule { }

