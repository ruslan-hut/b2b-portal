import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { WebhookService, Webhook, WebhookDelivery, WebhookUpsertRequest } from '../../core/services/webhook.service';
import { AdminService } from '../../core/services/admin.service';

@Component({
    selector: 'app-webhooks',
    templateUrl: './webhooks.component.html',
    styleUrls: ['./webhooks.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WebhooksComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  webhooks: Webhook[] = [];
  deliveries: WebhookDelivery[] = [];
  stores: any[] = [];

  loading = false;
  error: string | null = null;

  // Tab state
  activeTab: 'webhooks' | 'deliveries' = 'webhooks';

  // Pagination for webhooks (page-based, 1-indexed)
  webhooksPage = 1;
  webhooksCount = 20;
  webhooksTotal = 0;
  webhooksTotalPages = 1;

  // Pagination for deliveries (page-based, 1-indexed)
  deliveriesPage = 1;
  deliveriesCount = 20;
  deliveriesTotal = 0;
  deliveriesTotalPages = 1;
  selectedWebhookUID: string | null = null;

  // Edit mode
  showEditForm = false;
  editingWebhook: Webhook | null = null;
  webhookForm: FormGroup;

  // Test mode
  testLoading = false;
  testResult: { success: boolean; statusCode: number; error?: string } | null = null;

  // Expanded rows for deliveries
  expandedDeliveries = new Set<string>();

  constructor(
    private webhookService: WebhookService,
    private adminService: AdminService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.webhookForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      event: ['order_confirmed', Validators.required],
      store_uid: [null],
      auth_header: [''],
      auth_value: [''],
      active: [true]
    });
  }

  ngOnInit(): void {
    this.loadStores();
    this.loadWebhooks();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadStores(): void {
    this.subscriptions.add(
      this.adminService.listStores().subscribe({
        next: (stores) => {
          this.stores = stores || [];
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load stores:', err);
        }
      })
    );
  }

  loadWebhooks(): void {
    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.webhookService.listWebhooks(this.webhooksPage, this.webhooksCount).subscribe({
        next: (response) => {
          this.webhooks = response.data || [];
          this.webhooksTotal = response.pagination?.total || this.webhooks.length;
          this.webhooksTotalPages = response.pagination?.total_pages || 1;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load webhooks:', err);
          this.error = 'Failed to load webhooks';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  loadDeliveries(): void {
    this.loading = true;
    this.error = null;

    const observable = this.selectedWebhookUID
      ? this.webhookService.listDeliveriesByWebhook(this.selectedWebhookUID, this.deliveriesPage, this.deliveriesCount)
      : this.webhookService.listDeliveries(this.deliveriesPage, this.deliveriesCount);

    this.subscriptions.add(
      observable.subscribe({
        next: (response) => {
          this.deliveries = response.data || [];
          this.deliveriesTotal = response.pagination?.total || this.deliveries.length;
          this.deliveriesTotalPages = response.pagination?.total_pages || 1;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load deliveries:', err);
          this.error = 'Failed to load deliveries';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  switchTab(tab: 'webhooks' | 'deliveries'): void {
    this.activeTab = tab;
    this.error = null;

    if (tab === 'webhooks') {
      this.loadWebhooks();
    } else {
      this.loadDeliveries();
    }
  }

  // Webhook CRUD
  openNewWebhook(): void {
    this.editingWebhook = null;
    this.webhookForm.reset({
      name: '',
      url: '',
      event: 'order_confirmed',
      store_uid: null,
      auth_header: '',
      auth_value: '',
      active: true
    });
    this.testResult = null;
    this.showEditForm = true;
    this.cdr.detectChanges();
  }

  openEditWebhook(webhook: Webhook): void {
    this.editingWebhook = webhook;
    this.webhookForm.patchValue({
      name: webhook.name,
      url: webhook.url,
      event: webhook.event,
      store_uid: webhook.store_uid || null,
      auth_header: webhook.auth_header || '',
      auth_value: webhook.auth_value || '',
      active: webhook.active
    });
    this.testResult = null;
    this.showEditForm = true;
    this.cdr.detectChanges();
  }

  closeEditForm(): void {
    this.showEditForm = false;
    this.editingWebhook = null;
    this.testResult = null;
    this.cdr.detectChanges();
  }

  saveWebhook(): void {
    if (this.webhookForm.invalid) {
      return;
    }

    const formValue = this.webhookForm.value;
    const request: WebhookUpsertRequest = {
      uid: this.editingWebhook?.uid,
      name: formValue.name,
      url: formValue.url,
      event: formValue.event,
      store_uid: formValue.store_uid || null,
      auth_header: formValue.auth_header || '',
      auth_value: formValue.auth_value || '',
      active: formValue.active
    };

    this.loading = true;
    this.subscriptions.add(
      this.webhookService.upsertWebhooks([request]).subscribe({
        next: () => {
          this.loading = false;
          this.closeEditForm();
          this.loadWebhooks();
        },
        error: (err) => {
          console.error('Failed to save webhook:', err);
          this.error = 'Failed to save webhook';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  deleteWebhook(webhook: Webhook): void {
    if (!confirm(`Are you sure you want to delete webhook "${webhook.name}"?`)) {
      return;
    }

    this.subscriptions.add(
      this.webhookService.deleteWebhooks([webhook.uid]).subscribe({
        next: () => {
          this.loadWebhooks();
        },
        error: (err) => {
          console.error('Failed to delete webhook:', err);
          this.error = 'Failed to delete webhook';
          this.cdr.detectChanges();
        }
      })
    );
  }

  toggleWebhookActive(webhook: Webhook): void {
    this.subscriptions.add(
      this.webhookService.updateWebhookActive(webhook.uid, !webhook.active).subscribe({
        next: () => {
          webhook.active = !webhook.active;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to update webhook status:', err);
          this.error = 'Failed to update webhook status';
          this.cdr.detectChanges();
        }
      })
    );
  }

  // Test webhook
  testWebhook(): void {
    const formValue = this.webhookForm.value;
    if (!formValue.url) {
      return;
    }

    this.testLoading = true;
    this.testResult = null;

    this.subscriptions.add(
      this.webhookService.testWebhook(formValue.url, formValue.auth_header, formValue.auth_value).subscribe({
        next: (result) => {
          this.testResult = {
            success: result.success,
            statusCode: result.status_code,
            error: result.error
          };
          this.testLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to test webhook:', err);
          this.testResult = {
            success: false,
            statusCode: 0,
            error: err.message || 'Connection failed'
          };
          this.testLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  // Deliveries
  filterByWebhook(webhookUID: string | null): void {
    this.selectedWebhookUID = webhookUID;
    this.deliveriesPage = 1;
    this.loadDeliveries();
  }

  toggleDeliveryDetails(uid: string): void {
    if (this.expandedDeliveries.has(uid)) {
      this.expandedDeliveries.delete(uid);
    } else {
      this.expandedDeliveries.add(uid);
    }
  }

  isDeliveryExpanded(uid: string): boolean {
    return this.expandedDeliveries.has(uid);
  }

  cleanupDeliveries(): void {
    if (!confirm('Are you sure you want to cleanup old delivery logs? This action cannot be undone.')) {
      return;
    }

    this.subscriptions.add(
      this.webhookService.cleanupDeliveries(90).subscribe({
        next: (response) => {
          alert(`Cleanup completed. Deleted ${response.data || 0} delivery records.`);
          this.loadDeliveries();
        },
        error: (err) => {
          console.error('Failed to cleanup deliveries:', err);
          alert('Failed to cleanup deliveries');
        }
      })
    );
  }

  // Pagination
  goToWebhooksPage(page: number): void {
    this.webhooksPage = page;
    this.loadWebhooks();
  }

  goToDeliveriesPage(page: number): void {
    this.deliveriesPage = page;
    this.loadDeliveries();
  }

  // Helpers
  getStoreName(storeUID: string | null | undefined): string {
    if (!storeUID) {
      return 'All Stores';
    }
    const store = this.stores.find(s => s.uid === storeUID);
    return store?.name || storeUID;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'success':
        return 'status-success';
      case 'failed':
        return 'status-failed';
      case 'pending':
        return 'status-pending';
      default:
        return '';
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  formatJson(json: string | undefined): string {
    if (!json) return '';
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  }

  refresh(): void {
    if (this.activeTab === 'webhooks') {
      this.loadWebhooks();
    } else {
      this.loadDeliveries();
    }
  }

  copyToClipboard(text: string, event: Event): void {
    event.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      const button = event.target as HTMLElement;
      const icon = button.closest('.btn-copy')?.querySelector('.material-icons');
      if (icon) {
        icon.textContent = 'check';
        setTimeout(() => {
          icon.textContent = 'content_copy';
        }, 1500);
      }
    });
  }
}
