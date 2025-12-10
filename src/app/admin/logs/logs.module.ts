import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogsRoutingModule } from './logs-routing.module';
import { LogsComponent } from './logs.component';
import { CoreModule } from '../../core/core.module';

@NgModule({
  declarations: [
    LogsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    LogsRoutingModule,
    CoreModule
  ]
})
export class LogsModule { }
