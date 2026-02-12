import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BoxService } from '../services/box.service';
import { ShipmentBox } from '../models/shipment-box.model';

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

  private subscriptions = new Subscription();

  constructor(
    private boxService: BoxService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.boxForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', [Validators.maxLength(500)]],
      length_cm: ['', [Validators.required, Validators.min(1)]],
      width_cm: ['', [Validators.required, Validators.min(1)]],
      height_cm: ['', [Validators.required, Validators.min(1)]],
      max_weight_kg: ['', [Validators.min(0)]],
      active: [true]
    });
  }

  ngOnInit(): void {
    this.loadBoxes();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadBoxes(): void {
    this.loading = true;
    this.error = null;
    this.successMessage = null;

    this.subscriptions.add(
      this.boxService.listBoxes(this.page, this.count).subscribe({
        next: (response) => {
          this.boxes = response.data || [];
          this.total = response.pagination?.total || this.boxes.length;
          this.totalPages = response.pagination?.total_pages || 1;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to load boxes';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  openNewBox(): void {
    this.editingBox = null;
    this.boxForm.reset({ active: true });
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
      active: box.active
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
      active: this.boxForm.value.active
    };

    this.subscriptions.add(
      this.boxService.upsertBoxes([boxData]).subscribe({
        next: () => {
          this.successMessage = 'Box saved successfully';
          this.closeEditForm();
          this.loadBoxes();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to save box';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  deleteBox(box: ShipmentBox): void {
    if (!confirm(`Delete box "${box.name}"?`)) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.boxService.deleteBoxes([box.uid]).subscribe({
        next: () => {
          this.successMessage = 'Box deleted successfully';
          this.loadBoxes();
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to delete box';
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

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.loadBoxes();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.loadBoxes();
    }
  }
}
