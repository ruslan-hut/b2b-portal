import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ContentRoutingModule } from './content-routing.module';
import { ContentComponent } from './content.component';
import { ContentFilesComponent } from './files/files.component';
import { ContentLanguagesComponent } from './languages/languages.component';
import { ContentPageEditComponent } from './page-edit/page-edit.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    ContentComponent,
    ContentFilesComponent,
    ContentLanguagesComponent,
    ContentPageEditComponent
  ],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ContentRoutingModule, SharedModule]
})
export class ContentModule {}
