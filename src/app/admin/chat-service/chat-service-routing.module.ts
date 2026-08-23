import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChatServiceComponent } from './chat-service.component';

const routes: Routes = [
  {
    path: '',
    component: ChatServiceComponent,
    data: { title: 'Chat Service Settings' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ChatServiceRoutingModule { }
