import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductsCleanupComponent } from './products-cleanup.component';

const routes: Routes = [
  {
    path: '',
    component: ProductsCleanupComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductsCleanupRoutingModule { }
