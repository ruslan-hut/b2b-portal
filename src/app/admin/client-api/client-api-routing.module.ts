import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientApiComponent } from './client-api.component';
import { adminOnlyGuard } from '../../core/guards/admin.guard';

// One component, four tabs. Keys / requests / usage are admin-or-manager
// (managers see their store only — the backend scopes the data); settings is
// admin-only, and the guard sits on the child so the parent's admin-or-manager
// guard cannot let a manager through by inheritance.
const routes: Routes = [
  { path: '', redirectTo: 'keys', pathMatch: 'full' },
  { path: 'keys', component: ClientApiComponent },
  { path: 'requests', component: ClientApiComponent },
  { path: 'usage', component: ClientApiComponent },
  { path: 'settings', component: ClientApiComponent, canActivate: [adminOnlyGuard] }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientApiRoutingModule { }
