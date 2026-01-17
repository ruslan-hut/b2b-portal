import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TelegramRoutingModule } from './telegram-routing.module';
import { SubscriptionsComponent } from './subscriptions/subscriptions.component';
import { InvitesComponent } from './invites/invites.component';
import { SettingsComponent } from './settings/settings.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    SubscriptionsComponent,
    InvitesComponent,
    SettingsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TelegramRoutingModule,
    SharedModule
  ]
})
export class TelegramModule { }
