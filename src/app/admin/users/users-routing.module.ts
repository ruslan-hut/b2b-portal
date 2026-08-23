import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UsersComponent } from './users.component';
import { UserEditComponent } from './user-edit/user-edit.component';

const routes: Routes = [
  { path: '', component: UsersComponent },
  { path: 'new', component: UserEditComponent, data: { title: 'New user' } },
  { path: ':uid', component: UserEditComponent, data: { title: 'Edit user' } },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UsersRoutingModule { }
