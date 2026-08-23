import { NgModule, inject } from '@angular/core';
import { Router, RouterModule, Routes, UrlTree } from '@angular/router';
import { adminGuard, adminOnlyGuard, adminZoneGuard, contentEditorGuard } from '../core/guards/admin.guard';
import { AuthService } from '../core/services/auth.service';
import { AdminComponent } from './admin.component';

/**
 * Landing target for /admin, resolved per role.
 *
 * Content editors cannot enter the dashboard, so a static redirect would bounce
 * them straight back out to the client catalog on login. Runs in an injection
 * context, so `inject` is available here.
 */
const adminLandingRedirect = (): UrlTree => {
  const router = inject(Router);
  const role = inject(AuthService).currentUser?.role;
  return router.parseUrl(role === 'content_editor' ? '/admin/content' : '/admin/dashboard');
};

/**
 * Guard policy for this module:
 *
 * - The shell route uses `adminZoneGuard` so every staff role can render the
 *   admin chrome. It is NOT protection for anything below it.
 * - Every child therefore carries its own guard. `adminGuard` for operational
 *   screens, `adminOnlyGuard` for configuration, `contentEditorGuard` for the
 *   Partner Resources content zone, `adminZoneGuard` for the few screens all staff
 *   share (profile).
 *
 * Do not add a child route without a `canActivate`. Inheriting the shell guard
 * would expose it to every staff role.
 */
const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    canActivate: [adminZoneGuard],
    children: [
      {
        path: '',
        redirectTo: adminLandingRedirect,
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        canActivate: [adminGuard],
        loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardModule),
        data: { title: 'Dashboard' }
      },
      {
        path: 'clients',
        canActivate: [adminGuard],
        loadChildren: () => import('./clients/clients.module').then(m => m.ClientsModule),
        data: { title: 'Clients' }
      },
      {
        path: 'companies',
        canActivate: [adminGuard],
        loadChildren: () => import('./companies/companies.module').then(m => m.CompaniesModule),
        data: { title: 'Companies' }
      },
      {
        path: 'orders',
        canActivate: [adminGuard],
        loadChildren: () => import('./orders/orders.module').then(m => m.OrdersModule),
        data: { title: 'Orders' }
      },
      {
        path: 'products',
        canActivate: [adminGuard],
        loadChildren: () => import('./products/products.module').then(m => m.ProductsModule),
        data: { title: 'Products' }
      },
      {
        path: 'products-cleanup',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./products-cleanup/products-cleanup.module').then(m => m.ProductsCleanupModule),
        data: { title: 'Products Cleanup' }
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
        // Admin-only rather than admin-or-manager: the rows carry every
        // customer's IP address and device string.
        path: 'sessions',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./sessions/sessions.module').then(m => m.SessionsModule),
        data: { title: 'Sessions' }
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
        canActivate: [adminGuard],
        loadChildren: () => import('./crm/crm.module').then(m => m.CrmModule),
        data: { title: 'CRM' }
      },
      {
        path: 'chat',
        canActivate: [adminGuard],
        loadChildren: () => import('./chat/chat.module').then(m => m.ChatModule),
        data: { title: 'Chat' }
      },
      {
        path: 'content',
        canActivate: [contentEditorGuard],
        loadChildren: () => import('./content/content.module').then(m => m.ContentModule),
        data: { title: 'Partner Resources' }
      },
      {
        // Assistant configuration is admin-only; content editors reach the
        // assistant through the editor's actions, never through its settings.
        path: 'ai',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./ai/ai.module').then(m => m.AIModule),
        data: { title: 'AI assistant' }
      },
      {
        path: 'shipments',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./shipments/shipments.module').then(m => m.ShipmentsModule),
        data: { title: 'Shipments' }
      },
      {
        path: 'shipment',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./shipment/shipment.module').then(m => m.ShipmentModule),
        data: { title: 'Shipment' }
      },
      {
        path: 'chat-service',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./chat-service/chat-service.module').then(m => m.ChatServiceModule),
        data: { title: 'Chat Service' }
      },
      {
        // Keys / request log / usage are admin-or-manager (the backend scopes
        // managers to their store); the settings child carries adminOnlyGuard.
        path: 'client-api',
        canActivate: [adminGuard],
        loadChildren: () => import('./client-api/client-api.module').then(m => m.ClientApiModule),
        data: { title: 'Client API' }
      },
      {
        path: 'binotel',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./binotel/binotel.module').then(m => m.BinotelModule),
        data: { title: 'Telephony' }
      },
      {
        path: 'stores',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./stores/stores.module').then(m => m.StoresModule),
        data: { title: 'Stores' }
      },
      {
        path: 'tags',
        canActivate: [adminGuard],
        loadChildren: () => import('./tags/tags.module').then(m => m.TagsModule),
        data: { title: 'Tags' }
      },
      {
        // All staff manage their own profile, content editors included.
        path: 'profile',
        canActivate: [adminZoneGuard],
        loadChildren: () => import('./profile/profile.module').then(m => m.ProfileModule),
        data: { title: 'Profile' }
      },
      {
        path: 'settings',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule),
        data: { title: 'Settings' }
      },
      {
        path: 'general',
        canActivate: [adminOnlyGuard],
        loadChildren: () => import('./general/general.module').then(m => m.GeneralModule),
        data: { title: 'General Settings' }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
