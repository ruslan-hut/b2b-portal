import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ProductsRoutingModule } from './products-routing.module';
import { ProductCatalogComponent } from './product-catalog/product-catalog.component';
import { ProductDetailsOverlayComponent } from './product-details-overlay/product-details-overlay.component';
import { CartPageComponent } from './cart-page/cart-page.component';
import { CartAddressComponent } from './cart-address/cart-address.component';
import { OrderConfirmationDialogComponent } from './order-confirmation-dialog/order-confirmation-dialog.component';
import { CoreModule } from '../core/core.module';


@NgModule({
  declarations: [
    ProductCatalogComponent,
    ProductDetailsOverlayComponent,
    CartPageComponent,
    CartAddressComponent,
    OrderConfirmationDialogComponent
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
