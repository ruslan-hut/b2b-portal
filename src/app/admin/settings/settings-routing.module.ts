import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { MaintenanceSettingsComponent } from './maintenance/maintenance-settings.component';

const routes: Routes = [
  {
    path: '',
    component: SettingsComponent
  },
  {
    path: 'maintenance',
    component: MaintenanceSettingsComponent,
    data: { title: 'Maintenance mode' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SettingsRoutingModule { }
