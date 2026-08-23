import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { CrmService } from '../../services/crm.service';
import { CLIENT_PHASE_OPTIONS, CrmStage, CrmStageTranslation, CrmTransition } from '../../models/crm-stage.model';
import { StoreService } from '../../../../core/services/store.service';
import { Store } from '../../../../core/models/store.model';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminService } from '../../../../core/services/admin.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';

@Component({
    selector: 'app-crm-settings',
    templateUrl: './crm-settings.component.html',
    styleUrls: ['./crm-settings.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CrmSettingsComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  stages: CrmStage[] = [];
  transitions: CrmTransition[] = [];
  stores: { [uid: string]: Store } = {};
  storeOptions: { value: string; label: string }[] = [];

  loading = false;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Edit modal
  showStageModal = false;
  editingStage: CrmStage | null = null;
  stageForm: Partial<CrmStage> = {};

  // Localized stage names edited in the modal, keyed by language code
  availableLanguages: string[] = [];
  stageTranslations: { [lang: string]: string } = {};

  idCopied = false;

  readonly clientPhaseOptions = CLIENT_PHASE_OPTIONS;

  // Default colors
  defaultColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6', '#64748b', '#78716c'
  ];

  constructor(
    private crmService: CrmService,
    private storeService: StoreService,
    private authService: AuthService,
    private adminService: AdminService,
    private translationService: TranslationService,
    public router: Router,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('CRM Pipeline Settings');
    this.loadLanguages();
    this.loadData();
  }

  private loadLanguages(): void {
    this.subscriptions.add(
      this.adminService.getAvailableLanguages().subscribe({
        next: (langs) => {
          // Always allow configuring the app UI locales, plus any languages already in use.
          const set = new Set<string>(['en', 'uk']);
          (langs || []).forEach(l => l && set.add(l));
          set.add(this.translationService.getCurrentLanguage());
          this.availableLanguages = Array.from(set);
          this.cdr.detectChanges();
        },
        error: () => {
          this.availableLanguages = ['en', 'uk'];
          this.cdr.detectChanges();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    this.crmService.clearStagesCache();
    this.crmService.clearTransitionsCache();

    this.subscriptions.add(
      forkJoin({
        stages: this.crmService.getStages(),
        transitions: this.crmService.getTransitions(),
        stores: this.storeService.getStores()
      }).subscribe({
        next: ({ stages, transitions, stores }) => {
          this.stages = stages.sort((a, b) => a.sort_order - b.sort_order);
          this.transitions = transitions;
          this.stores = stores;

          this.storeOptions = [
            { value: '', label: 'All Stores (Global)' },
            ...Object.values(stores).map(s => ({
              value: s.uid,
              label: s.name
            })).sort((a, b) => a.label.localeCompare(b.label))
          ];

          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load CRM settings:', err);
          this.error = 'Failed to load CRM settings';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  // Stage management
  addStage(): void {
    this.editingStage = null;
    this.saving = false;
    this.error = null;
    this.stageForm = {
      uid: '',
      name: '',
      color: this.defaultColors[this.stages.length % this.defaultColors.length],
      sort_order: this.stages.length,
      is_initial: this.stages.length === 0,
      is_final: false,
      allow_edit: true,
      allow_create_shipment: false,
      allow_split: false,
      creates_allocation: this.stages.length === 0, // Default: initial stage creates allocations
      deletes_allocation: false,
      // Internal-only by default: a new stage must be opted in before clients see it
      client_phase: '',
      store_uid: '',
      active: true
    };
    this.stageTranslations = {};
    this.showStageModal = true;
    this.cdr.detectChanges();
  }

  editStage(stage: CrmStage): void {
    this.editingStage = stage;
    this.saving = false;
    this.error = null;
    this.idCopied = false;
    this.stageForm = { ...stage };
    this.stageTranslations = {};
    (stage.translations || []).forEach(t => {
      this.stageTranslations[t.language] = t.name;
    });
    this.showStageModal = true;
    this.cdr.detectChanges();
  }

  saveStage(): void {
    if (!this.stageForm.name?.trim()) {
      this.error = 'Stage name is required';
      return;
    }

    this.saving = true;
    this.error = null;

    const stage: CrmStage = {
      uid: this.editingStage?.uid || '',
      name: this.stageForm.name!.trim(),
      color: this.stageForm.color || '#6366f1',
      sort_order: this.stageForm.sort_order || 0,
      is_initial: this.stageForm.is_initial || false,
      is_final: this.stageForm.is_final || false,
      allow_edit: this.stageForm.allow_edit !== false,
      allow_create_shipment: this.stageForm.allow_create_shipment || false,
      allow_split: this.stageForm.allow_split || false,
      creates_allocation: this.stageForm.creates_allocation || false,
      deletes_allocation: this.stageForm.deletes_allocation || false,
      client_phase: this.stageForm.client_phase || '',
      store_uid: this.stageForm.store_uid || undefined,
      active: this.stageForm.active !== false,
      translations: this.buildTranslations()
    };

    this.subscriptions.add(
      this.crmService.upsertStages([stage]).subscribe({
        next: () => {
          this.saving = false;
          this.showStageModal = false;
          this.successMessage = 'Stage saved successfully';
          this.cdr.detectChanges();
          this.loadData();
          setTimeout(() => {
            this.successMessage = null;
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          console.error('Failed to save stage:', err);
          this.error = 'Failed to save stage';
          this.saving = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  async deleteStage(stage: CrmStage): Promise<void> {
    if (!await this.confirmDialog.ask({ message: `Are you sure you want to delete stage "${stage.name}"?`, danger: true })) {
      return;
    }

    this.subscriptions.add(
      this.crmService.deleteStages([stage.uid]).subscribe({
        next: () => {
          this.successMessage = 'Stage deleted successfully';
          this.loadData();
          setTimeout(() => {
            this.successMessage = null;
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          console.error('Failed to delete stage:', err);
          this.error = 'Failed to delete stage. Make sure no orders are in this stage.';
          this.cdr.detectChanges();
        }
      })
    );
  }

  cancelStageEdit(): void {
    this.showStageModal = false;
    this.editingStage = null;
    this.stageForm = {};
    this.stageTranslations = {};
    this.error = null;
    this.cdr.detectChanges();
  }

  /** Converts the per-language name inputs into the translations payload, dropping empties. */
  private buildTranslations(): CrmStageTranslation[] {
    return this.availableLanguages
      .map(lang => ({ language: lang, name: (this.stageTranslations[lang] || '').trim() }))
      .filter(t => t.name.length > 0);
  }

  /** Localized stage name for the current UI language, falling back to the base name. */
  localizedName(stage: CrmStage): string {
    const lang = this.translationService.getCurrentLanguage();
    const match = (stage.translations || []).find(t => t.language === lang && !!t.name);
    return match?.name || stage.name;
  }

  copyStageId(): void {
    if (!this.editingStage?.uid) return;
    navigator.clipboard.writeText(this.editingStage.uid).then(() => {
      this.idCopied = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.idCopied = false;
        this.cdr.detectChanges();
      }, 2000);
    });
  }

  selectColor(color: string): void {
    this.stageForm.color = color;
    this.cdr.detectChanges();
  }

  // Stage reorder
  dropStage(event: CdkDragDrop<CrmStage[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    moveItemInArray(this.stages, event.previousIndex, event.currentIndex);

    const reorderRequests = this.stages.map((stage, index) => ({
      uid: stage.uid,
      sort_order: index
    }));

    this.subscriptions.add(
      this.crmService.reorderStages(reorderRequests).subscribe({
        next: () => {
          this.stages.forEach((stage, index) => stage.sort_order = index);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to reorder stages:', err);
          this.error = 'Failed to reorder stages';
          this.loadData();
        }
      })
    );
  }

  // Transition management
  hasTransition(fromUid: string, toUid: string): boolean {
    return this.transitions.some(
      t => t.from_stage_uid === fromUid && t.to_stage_uid === toUid
    );
  }

  toggleTransition(fromUid: string, toUid: string): void {
    if (fromUid === toUid) {
      return;
    }

    const exists = this.hasTransition(fromUid, toUid);

    if (exists) {
      // Delete transition
      this.subscriptions.add(
        this.crmService.deleteTransitions([{ from_stage_uid: fromUid, to_stage_uid: toUid }]).subscribe({
          next: () => {
            this.transitions = this.transitions.filter(
              t => !(t.from_stage_uid === fromUid && t.to_stage_uid === toUid)
            );
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Failed to delete transition:', err);
            this.error = 'Failed to update transition';
            this.cdr.detectChanges();
          }
        })
      );
    } else {
      // Add transition
      this.subscriptions.add(
        this.crmService.upsertTransitions([{ from_stage_uid: fromUid, to_stage_uid: toUid }]).subscribe({
          next: () => {
            this.transitions.push({ from_stage_uid: fromUid, to_stage_uid: toUid });
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Failed to add transition:', err);
            this.error = 'Failed to update transition';
            this.cdr.detectChanges();
          }
        })
      );
    }
  }

  get canEdit(): boolean {
    const currentEntity = this.authService.currentEntityValue;
    // Check if it's a User (has role property) and is admin
    return !!(currentEntity && 'role' in currentEntity && currentEntity.role === 'admin');
  }

  getStoreName(uid: string | undefined): string {
    if (!uid) return 'All Stores';
    return this.stores[uid]?.name || uid;
  }
}
