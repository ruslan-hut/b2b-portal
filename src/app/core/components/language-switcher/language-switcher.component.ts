import { Component, OnInit, HostListener } from '@angular/core';
import { TranslationService, Language } from '../../services/translation.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-language-switcher',
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss']
})
export class LanguageSwitcherComponent implements OnInit {
  currentLanguage$: Observable<Language>;
  isDropdownOpen = false;
  
  languages: { code: Language; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'uk', label: 'Українська', flag: '🇺🇦' }
  ];

  constructor(private translationService: TranslationService) {
    this.currentLanguage$ = this.translationService.currentLanguage$;
  }

  ngOnInit(): void {}

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

  getCurrentFlag(): string {
    const currentLang = this.translationService.getCurrentLanguage();
    const language = this.languages.find(lang => lang.code === currentLang);
    return language ? language.flag : '🌐';
  }

  getCurrentLanguageLabel(): string {
    const currentLang = this.translationService.getCurrentLanguage();
    const language = this.languages.find(lang => lang.code === currentLang);
    return language ? language.label : '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clickedInside = target.closest('.language-switcher');
    if (!clickedInside) {
      this.closeDropdown();
    }
  }
}

