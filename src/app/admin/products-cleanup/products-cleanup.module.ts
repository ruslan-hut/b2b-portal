import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductsCleanupRoutingModule } from './products-cleanup-routing.module';
import { ProductsCleanupComponent } from './products-cleanup.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [ProductsCleanupComponent],
  imports: [
    CommonModule,
    ProductsCleanupRoutingModule,
    SharedModule
  ]
})
export class ProductsCleanupModule { }
