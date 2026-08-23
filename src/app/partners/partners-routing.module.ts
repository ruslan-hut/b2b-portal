import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HubComponent } from './hub/hub.component';
import { PartnerPageComponent } from './page/page.component';

/**
 * Partner Resources, client side.
 *
 * Reachable by everyone authenticated: clients, managers, content editors and
 * admins. Admins and content editors additionally see unpublished pages here,
 * marked as drafts, with a publish switch — the hub itself is the preview, so
 * there is no separate preview route.
 *
 * The page route is a wildcard because a page is addressed by its whole
 * ancestor chain — /partners/legal/certificates, not /partners/certificates.
 * Depth is whatever the editor builds, so no fixed set of :params would do.
 */
const routes: Routes = [
  { path: '', component: HubComponent },
  { path: '**', component: PartnerPageComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PartnersRoutingModule {}
