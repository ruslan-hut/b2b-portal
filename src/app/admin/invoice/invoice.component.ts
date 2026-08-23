import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { InvoiceService, InvoiceType, Invoice, InvoiceTypeUpsertRequest, InvoiceSettings } from '../../core/services/invoice.service';
import { AdminService } from '../../core/services/admin.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { NotificationService } from '../../core/services/notification.service';
import { CrmService } from '../crm/services/crm.service';
import { CrmStage } from '../crm/models/crm-stage.model';
import { formatDateTime } from '../../core/utils/date-format';
import { PageTitleService } from '../../core/services/page-title.service';

type TabType = 'types' | 'history';

@Component({
  selector: 'app-invoice',
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  // Settings
  settings: InvoiceSettings | null = null;
  settingsLoading = false;

  // Active tab
  activeTab: TabType = 'types';

  // Invoice Types
  invoiceTypes: InvoiceType[] = [];
  typesLoading = false;
  typesPage = 1;
  typesCount = 20;
  typesTotal = 0;
  typesTotalPages = 1;

  // Type form
  showTypeForm = false;
  editingType: InvoiceType | null = null;
  typeForm: FormGroup;
  headers: { key: string; value: string }[] = [];
  testLoading = false;
  testResult: { success: boolean; statusCode: number; error?: string } | null = null;

  // Invoices history
  invoices: Invoice[] = [];
  invoicesLoading = false;
  invoicesPage = 1;
  invoicesCount = 20;
  invoicesTotal = 0;
  invoicesTotalPages = 1;

  // Stores
  stores: any[] = [];

  // CRM stages (for the optional "move order to stage on success" setting)
  stages: CrmStage[] = [];

  // General
  error: string | null = null;

  constructor(
    private invoiceService: InvoiceService,
    private adminService: AdminService,
    private crmService: CrmService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService,
    private confirmDialog: ConfirmDialogService,
    private notifications: NotificationService
  ) {
    this.typeForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      method: ['POST', Validators.required],
      auth_username: ['', [Validators.maxLength(255)]],
      auth_password: ['', [Validators.maxLength(255)]],
      store_uid: [null],
      default_language: ['uk', [Validators.required, Validators.maxLength(10), Validators.pattern(/^[a-z]{2,10}$/)]],
      success_stage_uid: [null],
      active: [true]
    });
  }

  ngOnInit(): void {
    this.pageTitleService.setTitle('Invoice');
    this.loadSettings();
    this.loadStores();
    this.loadStages();
    this.loadTypes();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Settings
  loadSettings(): void {
    this.settingsLoading = true;
    this.subscriptions.add(
      this.invoiceService.getSettings().subscribe({
        next: (settings) => {
          this.settings = settings;
          this.settingsLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load settings:', err);
          this.settingsLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  toggleSettings(): void {
    if (!this.settings || this.settingsLoading) return;

    const newEnabled = !this.settings.enabled;
    this.settingsLoading = true;

    this.subscriptions.add(
      this.invoiceService.updateSettings(newEnabled).subscribe({
        next: (settings) => {
          this.settings = settings;
          this.settingsLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to update settings:', err);
          this.settingsLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  setActiveTab(tab: TabType): void {
    this.activeTab = tab;
    this.error = null;

    if (tab === 'types' && this.invoiceTypes.length === 0) {
      this.loadTypes();
    } else if (tab === 'history' && this.invoices.length === 0) {
      this.loadInvoices();
    }
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

  loadStages(): void {
    this.subscriptions.add(
      this.crmService.getStages().subscribe({
        next: (stages) => {
          this.stages = stages || [];
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load CRM stages:', err);
        }
      })
    );
  }

  // Invoice Types
  loadTypes(): void {
    this.typesLoading = true;
    this.subscriptions.add(
      this.invoiceService.listTypes(this.typesPage, this.typesCount).subscribe({
        next: (response) => {
          this.invoiceTypes = response.data || [];
          this.typesTotal = response.pagination?.total || this.invoiceTypes.length;
          this.typesTotalPages = response.pagination?.total_pages || 1;
          this.typesLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load types:', err);
          this.error = 'Failed to load invoice types';
          this.typesLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  openNewType(): void {
    this.editingType = null;
    this.typeForm.reset({
      name: '',
      url: '',
      method: 'POST',
      auth_username: '',
      auth_password: '',
      store_uid: null,
      default_language: 'uk',
      success_stage_uid: null,
      active: true
    });
    this.headers = [];
    this.testResult = null;
    this.showTypeForm = true;
    this.cdr.detectChanges();
  }

  openEditType(type: InvoiceType): void {
    this.editingType = type;
    this.typeForm.patchValue({
      name: type.name,
      url: type.url,
      method: type.method,
      auth_username: type.auth_username || '',
      auth_password: type.auth_password || '',
      store_uid: type.store_uid || null,
      default_language: type.default_language || 'uk',
      success_stage_uid: type.success_stage_uid || null,
      active: type.active
    });
    // Convert headers object to array
    this.headers = type.headers
      ? Object.entries(type.headers).map(([key, value]) => ({ key, value }))
      : [];
    this.testResult = null;
    this.showTypeForm = true;
    this.cdr.detectChanges();
  }

  closeTypeForm(): void {
    this.showTypeForm = false;
    this.editingType = null;
    this.headers = [];
    this.testResult = null;
    this.cdr.detectChanges();
  }

  saveType(): void {
    if (this.typeForm.invalid) return;

    const formValue = this.typeForm.value;
    const request: InvoiceTypeUpsertRequest = {
      uid: this.editingType?.uid,
      name: formValue.name,
      url: formValue.url,
      method: formValue.method,
      headers: this.getHeadersObject(),
      auth_username: formValue.auth_username || '',
      auth_password: formValue.auth_password || '',
      store_uid: formValue.store_uid || null,
      default_language: (formValue.default_language || 'uk').toLowerCase(),
      success_stage_uid: formValue.success_stage_uid || null,
      active: formValue.active
    };

    this.typesLoading = true;
    this.subscriptions.add(
      this.invoiceService.upsertTypes([request]).subscribe({
        next: () => {
          this.typesLoading = false;
          this.closeTypeForm();
          this.loadTypes();
        },
        error: (err) => {
          console.error('Failed to save type:', err);
          this.error = 'Failed to save invoice type';
          this.typesLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  async deleteType(type: InvoiceType): Promise<void> {
    if (!await this.confirmDialog.ask({ message: `Are you sure you want to delete type "${type.name}"?`, danger: true })) return;

    this.subscriptions.add(
      this.invoiceService.deleteTypes([type.uid]).subscribe({
        next: () => {
          this.loadTypes();
        },
        error: (err) => {
          console.error('Failed to delete type:', err);
          this.error = 'Failed to delete invoice type';
          this.cdr.detectChanges();
        }
      })
    );
  }

  toggleTypeActive(type: InvoiceType): void {
    this.subscriptions.add(
      this.invoiceService.updateTypeActive(type.uid, !type.active).subscribe({
        next: () => {
          type.active = !type.active;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to update type status:', err);
          this.error = 'Failed to update type status';
          this.cdr.detectChanges();
        }
      })
    );
  }

  testType(): void {
    const formValue = this.typeForm.value;
    if (!formValue.url) return;

    this.testLoading = true;
    this.testResult = null;

    this.subscriptions.add(
      this.invoiceService.testType(formValue.url, formValue.method, this.getHeadersObject(), formValue.auth_username, formValue.auth_password).subscribe({
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
          console.error('Failed to test type:', err);
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

  // Headers management
  addHeader(): void {
    this.headers.push({ key: '', value: '' });
    this.cdr.detectChanges();
  }

  removeHeader(index: number): void {
    this.headers.splice(index, 1);
    this.cdr.detectChanges();
  }

  private getHeadersObject(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const header of this.headers) {
      if (header.key.trim()) {
        result[header.key.trim()] = header.value;
      }
    }
    return result;
  }

  // Invoice History
  loadInvoices(): void {
    this.invoicesLoading = true;
    this.subscriptions.add(
      this.invoiceService.listInvoices(this.invoicesPage, this.invoicesCount).subscribe({
        next: (response) => {
          this.invoices = response.data || [];
          this.invoicesTotal = response.pagination?.total || this.invoices.length;
          this.invoicesTotalPages = response.pagination?.total_pages || 1;
          this.invoicesLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load invoices:', err);
          this.error = 'Failed to load invoice history';
          this.invoicesLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  openInvoice(invoice: Invoice): void {
    this.invoiceService.openInvoice(invoice);
  }

  async deleteInvoice(invoice: Invoice): Promise<void> {
    if (!await this.confirmDialog.ask({ message: `Are you sure you want to delete this invoice record?`, danger: true })) return;

    this.subscriptions.add(
      this.invoiceService.deleteInvoices([invoice.uid]).subscribe({
        next: () => {
          this.loadInvoices();
        },
        error: (err) => {
          console.error('Failed to delete invoice:', err);
          this.error = 'Failed to delete invoice';
          this.cdr.detectChanges();
        }
      })
    );
  }

  async cleanupInvoices(): Promise<void> {
    if (!await this.confirmDialog.ask({ message: 'Are you sure you want to cleanup old invoice records? This action cannot be undone.', danger: true })) return;

    this.subscriptions.add(
      this.invoiceService.cleanupInvoices(90).subscribe({
        next: (response) => {
          this.notifications.success(`Cleanup completed. Deleted ${response.data || 0} invoice records.`);
          this.loadInvoices();
        },
        error: (err) => {
          console.error('Failed to cleanup invoices:', err);
          this.notifications.error('Failed to cleanup invoices');
        }
      })
    );
  }

  // Pagination
  goToTypesPage(page: number): void {
    this.typesPage = page;
    this.loadTypes();
  }

  goToInvoicesPage(page: number): void {
    this.invoicesPage = page;
    this.loadInvoices();
  }

  // Helpers
  getStoreName(storeUID: string | null | undefined): string {
    if (!storeUID) return 'All Stores';
    const store = this.stores.find(s => s.uid === storeUID);
    return store?.name || storeUID;
  }

  getStageName(stageUID: string | null | undefined): string {
    if (!stageUID) return '—';
    const stage = this.stages.find(s => s.uid === stageUID);
    return stage?.name || stageUID;
  }

  getTypeName(typeUID: string): string {
    const type = this.invoiceTypes.find(t => t.uid === typeUID);
    return type?.name || typeUID;
  }

  formatDate(dateString: string): string {
    return formatDateTime(dateString);
  }

  getInvoiceStatusClass(invoice: Invoice): string {
    if (invoice.error) return 'status-error';
    if (invoice.status_code >= 200 && invoice.status_code < 300) return 'status-success';
    return 'status-warning';
  }
}
