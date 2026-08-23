import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ProfileRoutingModule } from './profile-routing.module';
import { ProfileComponent } from './profile.component';
import { ProfileApiKeysComponent } from './api-keys/profile-api-keys.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [
    ProfileComponent,
    ProfileApiKeysComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ProfileRoutingModule,
    SharedModule
  ]
})
export class ProfileModule { }
