import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TagsComponent } from './tags.component';
import { TagEditComponent } from './tag-edit/tag-edit.component';

const routes: Routes = [
  { path: '', component: TagsComponent },
  { path: 'new', component: TagEditComponent },
  { path: ':uid', component: TagEditComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TagsRoutingModule {}
