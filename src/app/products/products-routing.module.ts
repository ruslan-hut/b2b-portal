import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductCatalogComponent } from './product-catalog/product-catalog.component';
import { CartPageComponent } from './cart-page/cart-page.component';
import { clientGuard } from '../core/guards/client.guard';

const routes: Routes = [
  {
    path: 'catalog',
    component: ProductCatalogComponent,
    data: { title: 'navigation.products' }
  },
  {
    // Cart and ordering are client-only; staff browse the catalog in
    // read-only preview mode.
    path: 'cart',
    component: CartPageComponent,
    canActivate: [clientGuard],
    data: { title: 'navigation.cart' }
  },
  {
    path: '',
    redirectTo: 'catalog',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductsRoutingModule { }
