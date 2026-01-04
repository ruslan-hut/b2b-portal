import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablesRoutingModule } from './tables-routing.module';
import { TablesComponent } from './tables.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    TablesComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    TablesRoutingModule,
    SharedModule
  ]
})
export class TablesModule { }

