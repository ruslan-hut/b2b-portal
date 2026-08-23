import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionsRoutingModule } from './sessions-routing.module';
import { SessionsComponent } from './sessions.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    SessionsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SessionsRoutingModule,
    SharedModule
  ]
})
export class SessionsModule { }
