import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { AIRoutingModule } from './ai-routing.module';
import { AISettingsComponent } from './ai.component';

@NgModule({
  declarations: [AISettingsComponent],
  imports: [CommonModule, FormsModule, AIRoutingModule, SharedModule]
})
export class AIModule {}
