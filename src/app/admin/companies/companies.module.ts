import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompaniesRoutingModule } from './companies-routing.module';
import { CompaniesComponent } from './companies.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    CompaniesComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    CompaniesRoutingModule,
    SharedModule
  ]
})
export class CompaniesModule { }
