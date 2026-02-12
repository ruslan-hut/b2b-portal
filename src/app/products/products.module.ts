import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ProductsRoutingModule } from './products-routing.module';
import { ProductCatalogComponent } from './product-catalog/product-catalog.component';
import { ProductDetailsOverlayComponent } from './product-details-overlay/product-details-overlay.component';
import { CartPageComponent } from './cart-page/cart-page.component';
import { CartAddressComponent } from './cart-address/cart-address.component';
import { OrderConfirmationDialogComponent } from './order-confirmation-dialog/order-confirmation-dialog.component';
import { SharedModule } from '../shared/shared.module';
import { CategoryHeaderComponent } from './product-catalog/components/category-header/category-header.component';
import { ProductCardComponent } from './product-catalog/components/product-card/product-card.component';
import { ImagePreviewModalComponent } from './product-catalog/components/image-preview-modal/image-preview-modal.component';
import { PaginationControlsComponent } from './product-catalog/components/pagination-controls/pagination-controls.component';
import { ProductGridComponent } from './product-catalog/components/product-grid/product-grid.component';
import { SearchBarComponent } from './product-catalog/components/search-bar/search-bar.component';
import { BulkActionsBarComponent } from './product-catalog/components/bulk-actions-bar/bulk-actions-bar.component';
import { BulkProductCardComponent } from './product-catalog/components/bulk-product-card/bulk-product-card.component';
import { BulkCardListComponent } from './product-catalog/components/bulk-card-list/bulk-card-list.component';
import { BulkTableComponent } from './product-catalog/components/bulk-table/bulk-table.component';
import { BulkDetailPanelComponent } from './product-catalog/components/bulk-detail-panel/bulk-detail-panel.component';


@NgModule({
  declarations: [
    ProductCatalogComponent,
    ProductDetailsOverlayComponent,
    CartPageComponent,
    CartAddressComponent,
    OrderConfirmationDialogComponent,
    CategoryHeaderComponent,
    ProductCardComponent,
    ImagePreviewModalComponent,
    PaginationControlsComponent,
    ProductGridComponent,
    SearchBarComponent,
    BulkActionsBarComponent,
    BulkProductCardComponent,
    BulkCardListComponent,
    BulkTableComponent,
    BulkDetailPanelComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ProductsRoutingModule,
    SharedModule
  ]
})
export class ProductsModule { }
