import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ClientApiRoutingModule } from './client-api-routing.module';
import { ClientApiComponent } from './client-api.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [ClientApiComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ClientApiRoutingModule, SharedModule]
})
export class ClientApiModule { }
