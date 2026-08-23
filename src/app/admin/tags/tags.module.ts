import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TagsRoutingModule } from './tags-routing.module';
import { TagsComponent } from './tags.component';
import { TagEditComponent } from './tag-edit/tag-edit.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [TagsComponent, TagEditComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TagsRoutingModule, SharedModule]
})
export class TagsModule {}
