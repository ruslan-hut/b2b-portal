import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatServiceRoutingModule } from './chat-service-routing.module';
import { ChatServiceComponent } from './chat-service.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    ChatServiceComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ChatServiceRoutingModule,
    SharedModule
  ]
})
export class ChatServiceModule { }
