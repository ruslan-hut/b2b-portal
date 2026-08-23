import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { SettingsRoutingModule } from './settings-routing.module';
import { SettingsComponent } from './settings.component';
import { MaintenanceSettingsComponent } from './maintenance/maintenance-settings.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    SettingsComponent,
    MaintenanceSettingsComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SettingsRoutingModule,
    SharedModule
  ]
})
export class SettingsModule { }
