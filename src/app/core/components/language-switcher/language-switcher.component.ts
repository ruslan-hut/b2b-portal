import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslationService, Language } from '../../services/translation.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-language-switcher',
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)'
  }
})
export class LanguageSwitcherComponent {
  private readonly translationService = inject(TranslationService);

  readonly currentLanguage$: Observable<Language> = this.translationService.currentLanguage$;
  isDropdownOpen = false;

  readonly languages: { code: Language; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'uk', label: 'Українська' }
  ];

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  selectLanguage(language: Language): void {
    this.translationService.setLanguage(language);
    this.closeDropdown();
  }

  getCurrentLanguageCode(): string {
    return this.translationService.getCurrentLanguage().toUpperCase();
  }

  getCurrentLanguageLabel(): string {
    const currentLang = this.translationService.getCurrentLanguage();
    const language = this.languages.find(lang => lang.code === currentLang);
    return language ? language.label : '';
  }

  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clickedInside = target.closest('.language-switcher');
    if (!clickedInside) {
      this.closeDropdown();
    }
  }
}
