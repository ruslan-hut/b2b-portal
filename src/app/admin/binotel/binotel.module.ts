import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BinotelRoutingModule } from './binotel-routing.module';
import { BinotelComponent } from './binotel.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    BinotelComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    BinotelRoutingModule,
    SharedModule
  ]
})
export class BinotelModule { }
