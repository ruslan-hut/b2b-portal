import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SettingsComponent } from './settings/settings.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'settings',
    pathMatch: 'full'
  },
  {
    path: 'settings',
    component: SettingsComponent,
    data: { title: 'General Settings' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class GeneralRoutingModule { }
