import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { OrdersRoutingModule } from './orders-routing.module';
import { OrderHistoryComponent } from './order-history/order-history.component';
import { OrderDetailComponent } from './order-detail/order-detail.component';
import { CatalogExportDialogComponent } from './catalog-export-dialog/catalog-export-dialog.component';
import { OrderImportDialogComponent } from './order-import-dialog/order-import-dialog.component';
import { SharedModule } from '../shared/shared.module';


@NgModule({
  declarations: [
    OrderHistoryComponent,
    OrderDetailComponent,
    CatalogExportDialogComponent,
    OrderImportDialogComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    OrdersRoutingModule,
    SharedModule
  ]
})
export class OrdersModule { }
