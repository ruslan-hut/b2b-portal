import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { adminGuard, adminOnlyGuard } from '../core/guards/admin.guard';
import { AdminComponent } from './admin.component';

const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    canActivate: [adminGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardModule),
        data: { title: 'Dashboard' }
      },
      {
        path: 'clients',
        loadChildren: () => import('./clients/clients.module').then(m => m.ClientsModule),
        data: { title: 'Clients' }
      },
      {
        path: 'orders',
        loadChildren: () => import('./orders/orders.module').then(m => m.OrdersModule),
        data: { title: 'Orders' }
      },
      {
        path: 'products',
        loadChildren: () => import('./products/products.module').then(m => m.ProductsModule),
        data: { title: 'Products' }
      },
      {
        path: 'users',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./users/users.module').then(m => m.UsersModule),
        data: { title: 'Users' }
      },
      {
        path: 'tables',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./tables/tables.module').then(m => m.TablesModule),
        data: { title: 'Tables' }
      },
      {
        path: 'logs',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./logs/logs.module').then(m => m.LogsModule),
        data: { title: 'Logs' }
      },
      {
        path: 'webhooks',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./webhooks/webhooks.module').then(m => m.WebhooksModule),
        data: { title: 'Webhooks' }
      },
      {
        path: 'telegram',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./telegram/telegram.module').then(m => m.TelegramModule),
        data: { title: 'Telegram' }
      },
      {
        path: 'mail',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./mail/mail.module').then(m => m.MailModule),
        data: { title: 'Mail' }
      },
      {
        path: 'invoice',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./invoice/invoice.module').then(m => m.InvoiceModule),
        data: { title: 'Invoice' }
      },
      {
        path: 'crm',
        loadChildren: () => import('./crm/crm.module').then(m => m.CrmModule),
        data: { title: 'CRM' }
      },
      {
        path: 'chat',
        loadChildren: () => import('./chat/chat.module').then(m => m.ChatModule),
        data: { title: 'Chat' }
      },
      {
        path: 'shipment',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./shipment/shipment.module').then(m => m.ShipmentModule),
        data: { title: 'Shipment' }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }

