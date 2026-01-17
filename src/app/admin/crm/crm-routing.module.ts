import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CrmComponent } from './crm.component';
import { CrmSettingsComponent } from './pages/settings/crm-settings.component';
import { MyTasksComponent } from './pages/my-tasks/my-tasks.component';
import { CrmDashboardComponent } from './pages/dashboard/crm-dashboard.component';
import { WorkloadComponent } from './pages/workload/workload.component';

const routes: Routes = [
  {
    path: '',
    component: CrmComponent,
    data: { title: 'CRM Pipeline' }
  },
  {
    path: 'dashboard',
    component: CrmDashboardComponent,
    data: { title: 'CRM Dashboard' }
  },
  {
    path: 'workload',
    component: WorkloadComponent,
    data: { title: 'CRM Workload' }
  },
  {
    path: 'settings',
    component: CrmSettingsComponent,
    data: { title: 'CRM Settings' }
  },
  {
    path: 'my-tasks',
    component: MyTasksComponent,
    data: { title: 'My Tasks' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CrmRoutingModule { }
