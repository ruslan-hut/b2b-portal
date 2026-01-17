import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SubscriptionsComponent } from './subscriptions/subscriptions.component';
import { InvitesComponent } from './invites/invites.component';
import { SettingsComponent } from './settings/settings.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'subscriptions',
    pathMatch: 'full'
  },
  {
    path: 'subscriptions',
    component: SubscriptionsComponent,
    data: { title: 'Telegram Subscriptions' }
  },
  {
    path: 'invites',
    component: InvitesComponent,
    data: { title: 'Telegram Invites' }
  },
  {
    path: 'settings',
    component: SettingsComponent,
    data: { title: 'Telegram Settings' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TelegramRoutingModule { }
