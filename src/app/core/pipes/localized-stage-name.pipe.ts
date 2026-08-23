import { Pipe, PipeTransform, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../services/translation.service';
import { CrmStage } from '../../admin/crm/models/crm-stage.model';

/**
 * Resolves a CRM stage's display name to the translation for the current UI language,
 * falling back to the base stage name when no translation exists. Impure so it updates
 * when the language changes (mirrors TranslatePipe).
 */
@Pipe({
  name: 'localizedStageName',
  pure: false,
  standalone: false
})
export class LocalizedStageNamePipe implements PipeTransform, OnDestroy {
  private subscription?: Subscription;

  constructor(
    private translationService: TranslationService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.subscription = this.translationService.currentLanguage$.subscribe(() => {
      this.changeDetectorRef.markForCheck();
    });
  }

  transform(stage: CrmStage | null | undefined): string {
    if (!stage) {
      return '';
    }
    const lang = this.translationService.getCurrentLanguage();
    const match = stage.translations?.find(t => t.language === lang && !!t.name);
    return match?.name || stage.name;
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
