import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/products/catalog',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule),
    data: { title: 'Login' }
  },
  {
    path: 'products',
    loadChildren: () => import('./products/products.module').then(m => m.ProductsModule),
    canActivate: [authGuard]
  },
  {
    path: 'orders',
    loadChildren: () => import('./orders/orders.module').then(m => m.OrdersModule),
    canActivate: [authGuard]
  },
  {
    path: 'partners',
    loadChildren: () => import('./partners/partners.module').then(m => m.PartnersModule),
    canActivate: [authGuard],
    data: { title: 'partners.title' }
  },
  {
    path: 'profile',
    loadChildren: () => import('./profile/profile.module').then(m => m.ProfileModule),
    canActivate: [authGuard],
    data: { title: 'navigation.profile' }
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
  },
  {
    // Public: the Client API contract holds no secrets and integrators need
    // it before they hold a key.
    path: 'api-docs',
    loadChildren: () => import('./api-docs/api-docs.module').then(m => m.ApiDocsModule),
    data: { title: 'Client API' }
  },
  {
    // Public for the same reason as /api-docs, and linked from the profile so a
    // client without API access can still read what the feature is.
    path: 'api-guide',
    loadChildren: () => import('./api-guide/api-guide.module').then(m => m.ApiGuideModule),
    data: { title: 'Client API' }
  },
  {
    path: '**',
    redirectTo: '/products/catalog'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
