import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ApiDocsComponent } from './api-docs.component';

const routes: Routes = [{ path: '', component: ApiDocsComponent }];

@NgModule({
  declarations: [ApiDocsComponent],
  imports: [CommonModule, RouterModule.forChild(routes)]
})
export class ApiDocsModule { }
