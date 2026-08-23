import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeneralRoutingModule } from './general-routing.module';
import { SettingsComponent } from './settings/settings.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    SettingsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    GeneralRoutingModule,
    SharedModule
  ]
})
export class GeneralModule { }
