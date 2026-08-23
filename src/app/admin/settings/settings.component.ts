import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';

interface SettingsCard {
  icon: string;
  title: string;
  description: string;
  route: string;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent {
  readonly cards: SettingsCard[] = [
    {
      icon: 'tune',
      title: 'admin.settings.general',
      description: 'admin.settings.generalDesc',
      route: '/admin/general'
    },
    {
      icon: 'person',
      title: 'admin.settings.users',
      description: 'admin.settings.usersDesc',
      route: '/admin/users'
    },
    {
      icon: 'webhook',
      title: 'admin.settings.webhooks',
      description: 'admin.settings.webhooksDesc',
      route: '/admin/webhooks'
    },
    {
      icon: 'vpn_key',
      title: 'admin.settings.clientApi',
      description: 'admin.settings.clientApiDesc',
      route: '/admin/client-api'
    },
    {
      icon: 'send',
      title: 'admin.settings.telegram',
      description: 'admin.settings.telegramDesc',
      route: '/admin/telegram'
    },
    {
      icon: 'email',
      title: 'admin.settings.mail',
      description: 'admin.settings.mailDesc',
      route: '/admin/mail'
    },
    {
      icon: 'receipt_long',
      title: 'admin.settings.invoice',
      description: 'admin.settings.invoiceDesc',
      route: '/admin/invoice'
    },
    {
      icon: 'local_shipping',
      title: 'admin.settings.shipment',
      description: 'admin.settings.shipmentDesc',
      route: '/admin/shipment'
    },
    {
      icon: 'store',
      title: 'admin.settings.stores',
      description: 'admin.settings.storesDesc',
      route: '/admin/stores'
    },
    {
      icon: 'support_agent',
      title: 'admin.settings.chatService',
      description: 'admin.settings.chatServiceDesc',
      route: '/admin/chat-service'
    },
    {
      icon: 'phone_in_talk',
      title: 'admin.settings.binotel',
      description: 'admin.settings.binotelDesc',
      route: '/admin/binotel'
    },
    {
      icon: 'auto_awesome',
      title: 'admin.settings.ai',
      description: 'admin.settings.aiDesc',
      route: '/admin/ai'
    },
    {
      icon: 'table_chart',
      title: 'admin.settings.tables',
      description: 'admin.settings.tablesDesc',
      route: '/admin/tables'
    },
    {
      icon: 'cleaning_services',
      title: 'admin.settings.productsCleanup',
      description: 'admin.settings.productsCleanupDesc',
      route: '/admin/products-cleanup'
    },
    {
      icon: 'description',
      title: 'admin.settings.logs',
      description: 'admin.settings.logsDesc',
      route: '/admin/logs'
    },
    {
      icon: 'network_check',
      title: 'admin.settings.sessions',
      description: 'admin.settings.sessionsDesc',
      route: '/admin/sessions'
    },
    {
      icon: 'build',
      title: 'admin.settings.maintenance',
      description: 'admin.settings.maintenanceDesc',
      route: '/admin/settings/maintenance'
    }
  ];

  constructor(private router: Router) {}

  navigate(route: string): void {
    this.router.navigate([route]);
  }
}
