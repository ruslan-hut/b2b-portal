import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AISettingsComponent } from './ai.component';

const routes: Routes = [
  {
    path: '',
    component: AISettingsComponent,
    data: { title: 'AI assistant' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AIRoutingModule {}
