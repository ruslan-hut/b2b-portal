import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { WebhooksRoutingModule } from './webhooks-routing.module';
import { WebhooksComponent } from './webhooks.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    WebhooksComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    WebhooksRoutingModule,
    SharedModule
  ]
})
export class WebhooksModule { }
