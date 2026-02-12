import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type Language = string;

// Languages that have UI translation files
const SUPPORTED_UI_LANGUAGES = ['en', 'uk'];

export interface TranslationData {
  [key: string]: string | TranslationData;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private currentLanguageSubject = new BehaviorSubject<Language>('en');
  private translationsSubject = new BehaviorSubject<TranslationData>({});

  public currentLanguage$ = this.currentLanguageSubject.asObservable();
  public translations$ = this.translationsSubject.asObservable();

  private translations: { [key: string]: TranslationData } = {};
  private readonly LANGUAGE_KEY = 'app_language';
  private translationsLoaded = false;

  constructor() {
    this.initializeLanguage();
  }

  /**
   * Initialize language from localStorage or default to 'en'
   */
  private initializeLanguage(): void {
    const savedLanguage = localStorage.getItem(this.LANGUAGE_KEY);
    if (savedLanguage) {
      this.currentLanguageSubject.next(savedLanguage);
    }
  }

  /**
   * Initialize translations - must be called before app bootstrap
   * Returns a Promise to be used with APP_INITIALIZER
   */
  initTranslations(): Promise<void> {
    return this.loadTranslations();
  }

  /**
   * Load translations for both languages
   */
  private async loadTranslations(): Promise<void> {
    try {
      const [enTranslations, ukTranslations] = await Promise.all([
        fetch('assets/i18n/en.json').then(res => res.json()),
        fetch('assets/i18n/uk.json').then(res => res.json())
      ]);

      this.translations['en'] = enTranslations;
      this.translations['uk'] = ukTranslations;
      this.translationsLoaded = true;

      // Emit current language translations
      this.updateCurrentTranslations();
    } catch (error) {
      console.error('Failed to load translations:', error);
      // Fallback to empty translations
      this.translations['en'] = {};
      this.translations['uk'] = {};
      this.translationsLoaded = true;
    }
  }

  /**
   * Update translations observable with current language
   * Falls back to 'en' if the current language has no UI translations loaded
   */
  private updateCurrentTranslations(): void {
    const currentLang = this.currentLanguageSubject.value;
    const uiLang = this.translations[currentLang] ? currentLang : 'en';
    this.translationsSubject.next(this.translations[uiLang] || {});
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): Language {
    return this.currentLanguageSubject.value;
  }

  /**
   * Set current language
   */
  setLanguage(language: Language): void {
    if (language !== this.currentLanguageSubject.value) {
      this.currentLanguageSubject.next(language);
      localStorage.setItem(this.LANGUAGE_KEY, language);
      this.updateCurrentTranslations();
    }
  }

  /**
   * Toggle between English and Ukrainian
   */
  toggleLanguage(): void {
    const currentLang = this.getCurrentLanguage();
    const newLang: Language = currentLang === 'en' ? 'uk' : 'en';
    this.setLanguage(newLang);
  }

  /**
   * Get translation for a key (supports nested keys with dot notation)
   * @param key - Translation key (e.g., 'common.welcome' or 'products.title')
   * @param params - Optional parameters for interpolation (e.g., {name: 'John'})
   * @returns Translated string or the key itself if not found
   */
  translate(key: string, params?: { [key: string]: string | number }): string {
    const currentLang = this.getCurrentLanguage();
    const uiLang = this.translations[currentLang] ? currentLang : 'en';
    const translations = this.translations[uiLang] || {};
    
    // Navigate through nested keys
    const keys = key.split('.');
    let value: any = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Return key if translation not found
        return key;
      }
    }

    // If value is not a string, return the key
    if (typeof value !== 'string') {
      return key;
    }

    // Interpolate parameters if provided
    if (params) {
      return this.interpolate(value, params);
    }

    return value;
  }

  /**
   * Get instant translation (synchronous)
   * Use this method in components after translations are loaded
   */
  instant(key: string, params?: { [key: string]: string | number }): string {
    return this.translate(key, params);
  }

  /**
   * Get translation as observable (reactive)
   * Use this for template bindings that need to update when language changes
   */
  get(key: string, params?: { [key: string]: string | number }): Observable<string> {
    return new Observable(observer => {
      const subscription = this.translations$.subscribe(() => {
        observer.next(this.translate(key, params));
      });

      // Emit initial value
      observer.next(this.translate(key, params));

      return () => subscription.unsubscribe();
    });
  }

  /**
   * Replace placeholders in string with actual values
   * @param text - Text with placeholders like {{name}}
   * @param params - Parameters object
   */
  private interpolate(text: string, params: { [key: string]: string | number }): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  /**
   * Check if translations are loaded
   */
  areTranslationsLoaded(): boolean {
    return this.translationsLoaded;
  }
}

