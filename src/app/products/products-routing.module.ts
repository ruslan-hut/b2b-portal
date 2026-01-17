import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductCatalogComponent } from './product-catalog/product-catalog.component';
import { CartPageComponent } from './cart-page/cart-page.component';

const routes: Routes = [
  {
    path: 'catalog',
    component: ProductCatalogComponent,
    data: { title: 'Catalog' }
  },
  {
    path: 'cart',
    component: CartPageComponent,
    data: { title: 'Cart' }
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
