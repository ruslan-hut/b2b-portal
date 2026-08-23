import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BoxService } from '../services/box.service';
import { ShipmentBox } from '../models/shipment-box.model';
import { ShipmentStoreContextService } from '../services/shipment-store-context.service';
import { AdminService } from '../../../core/services/admin.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-boxes',
  templateUrl: './boxes.component.html',
  styleUrls: ['./boxes.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoxesComponent implements OnInit, OnDestroy {
  boxes: ShipmentBox[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Pagination
  page = 1;
  count = 20;
  total = 0;
  totalPages = 1;

  // Edit form
  showEditForm = false;
  editingBox: ShipmentBox | null = null;
  boxForm: FormGroup;

  // Store scope
  stores: { uid: string; name: string }[] = [];
  private storeNames: Record<string, string> = {};
  currentStoreLabel = '';

  private subscriptions = new Subscription();

  constructor(
    private boxService: BoxService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private storeContext: ShipmentStoreContextService,
    private adminService: AdminService,
    private translation: TranslationService,
    private confirmDialog: ConfirmDialogService
  ) {
    this.boxForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', [Validators.maxLength(500)]],
      length_cm: ['', [Validators.required, Validators.min(1)]],
      width_cm: ['', [Validators.required, Validators.min(1)]],
      height_cm: ['', [Validators.required, Validators.min(1)]],
      max_weight_kg: ['', [Validators.min(0)]],
      active: [true],
      store_uid: [null as string | null]
    });
  }

  ngOnInit(): void {
    const fromUrl = this.route.snapshot.queryParamMap.get('store') ?? '';
    if (fromUrl) {
      this.storeContext.set(fromUrl);
    }
    this.loadStoreOptions();
    this.subscriptions.add(
      this.storeContext.selectedStore$.subscribe((uid) => {
        this.currentStoreLabel = uid ? (this.storeNames[uid] || uid) : '';
        this.page = 1;
        this.loadBoxes();
      })
    );
  }

  private loadStoreOptions(): void {
    this.subscriptions.add(
      this.adminService.listStores().subscribe({
        next: (stores) => {
          this.stores = (stores || []).map((s: any) => ({ uid: s.uid, name: s.name || s.uid }));
          this.storeNames = {};
          for (const s of this.stores) {
            this.storeNames[s.uid] = s.name;
          }
          const current = this.storeContext.value;
          this.currentStoreLabel = current ? (this.storeNames[current] || current) : '';
          this.cdr.detectChanges();
        }
      })
    );
  }

  storeLabel(uid: string | null | undefined): string {
    if (!uid) {
      return this.translation.translate('admin.shipment.scopeShared');
    }
    return this.storeNames[uid] || uid;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadBoxes(): void {
    this.loading = true;
    this.error = null;
    this.successMessage = null;

    this.subscriptions.add(
      this.boxService.listBoxes(this.page, this.count, this.storeContext.value || undefined).subscribe({
        next: (response) => {
          this.boxes = response.data || [];
          this.total = response.pagination?.total || this.boxes.length;
          this.totalPages = response.pagination?.total_pages || 1;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.message || this.translation.translate('shipment.boxes.loadFailed');
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  openNewBox(): void {
    this.editingBox = null;
    // Default new boxes to the currently selected store so they land in the right scope.
    this.boxForm.reset({ active: true, store_uid: this.storeContext.value || null });
    this.showEditForm = true;
    this.error = null;
    this.successMessage = null;
    this.cdr.detectChanges();
  }

  openEditBox(box: ShipmentBox): void {
    this.editingBox = box;
    this.boxForm.patchValue({
      name: box.name,
      description: box.description || '',
      length_cm: box.length_cm,
      width_cm: box.width_cm,
      height_cm: box.height_cm,
      max_weight_kg: box.max_weight_kg || '',
      active: box.active,
      store_uid: box.store_uid ?? null
    });
    this.showEditForm = true;
    this.error = null;
    this.successMessage = null;
    this.cdr.detectChanges();
  }

  closeEditForm(): void {
    this.showEditForm = false;
    this.editingBox = null;
    this.boxForm.reset();
    this.error = null;
    this.cdr.detectChanges();
  }

  saveBox(): void {
    if (this.boxForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = null;

    const boxData: Partial<ShipmentBox> = {
      uid: this.editingBox?.uid || '',
      name: this.boxForm.value.name,
      description: this.boxForm.value.description || undefined,
      length_cm: Number(this.boxForm.value.length_cm),
      width_cm: Number(this.boxForm.value.width_cm),
      height_cm: Number(this.boxForm.value.height_cm),
      max_weight_kg: this.boxForm.value.max_weight_kg ? Number(this.boxForm.value.max_weight_kg) : undefined,
      active: this.boxForm.value.active,
      store_uid: this.boxForm.value.store_uid || undefined
    };

    this.subscriptions.add(
      this.boxService.upsertBoxes([boxData]).subscribe({
        next: () => {
          this.successMessage = this.translation.translate('shipment.boxes.saveSuccess');
          this.closeEditForm();
          this.loadBoxes();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.message || this.translation.translate('shipment.boxes.saveFailed');
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  async deleteBox(box: ShipmentBox): Promise<void> {
    const message = `${this.translation.translate('shipment.boxes.deleteConfirmation')} (${box.name})`;
    if (!await this.confirmDialog.ask({ message, danger: true })) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.boxService.deleteBoxes([box.uid]).subscribe({
        next: () => {
          this.successMessage = this.translation.translate('shipment.boxes.deleteSuccess');
          this.loadBoxes();
        },
        error: (err) => {
          this.error = err.error?.message || this.translation.translate('shipment.boxes.deleteFailed');
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  refresh(): void {
    this.page = 1;
    this.loadBoxes();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }
    this.page = page;
    this.loadBoxes();
  }
}
