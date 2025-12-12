import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ProductsRoutingModule } from './products-routing.module';
import { ProductCatalogComponent } from './product-catalog/product-catalog.component';
import { ProductDetailsOverlayComponent } from './product-details-overlay/product-details-overlay.component';
import { CoreModule } from '../core/core.module';


@NgModule({
  declarations: [
    ProductCatalogComponent,
    ProductDetailsOverlayComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ProductsRoutingModule,
    CoreModule
  ]
})
export class ProductsModule { }
