import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { adminOnlyGuard } from '../../core/guards/admin.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { ContentComponent } from './content.component';
import { ContentFilesComponent } from './files/files.component';
import { ContentLanguagesComponent } from './languages/languages.component';
import { ContentPageEditComponent } from './page-edit/page-edit.component';

/**
 * Partner Resources content zone.
 *
 * The parent route in AdminRoutingModule already applies `contentEditorGuard`
 * (admin + content_editor), so children only need their own guard where they
 * are narrower than that — the language registry is admin-only, because
 * editors pick languages but must not invent them.
 *
 * Static segments are declared before ':uid' for readability; chi-style
 * shadowing is not a concern in the Angular router, which matches in
 * declaration order.
 */
const routes: Routes = [
  { path: '', component: ContentComponent },
  {
    path: 'new',
    component: ContentPageEditComponent,
    canDeactivate: [unsavedChangesGuard],
    data: { title: 'New page' }
  },
  { path: 'files', component: ContentFilesComponent, data: { title: 'Media library' } },
  {
    path: 'languages',
    canActivate: [adminOnlyGuard],
    component: ContentLanguagesComponent,
    data: { title: 'Content languages' }
  },
  {
    path: ':uid',
    component: ContentPageEditComponent,
    canDeactivate: [unsavedChangesGuard],
    data: { title: 'Edit page' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ContentRoutingModule {}
