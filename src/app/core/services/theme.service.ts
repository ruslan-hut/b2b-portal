import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, fromEvent } from 'rxjs';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'app_theme';
  private readonly DEFAULT_THEME: Theme = 'system';

  private themeSubject = new BehaviorSubject<Theme>(this.DEFAULT_THEME);
  private resolvedThemeSubject = new BehaviorSubject<ResolvedTheme>('light');

  public theme$ = this.themeSubject.asObservable();
  public resolvedTheme$ = this.resolvedThemeSubject.asObservable();

  private isBrowser: boolean;
  private mediaQuery: MediaQueryList | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this.initializeTheme();
      this.setupSystemThemeListener();
    }
  }

  /**
   * Initialize theme from localStorage or default to 'system'
   */
  private initializeTheme(): void {
    const savedTheme = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
    const theme = this.isValidTheme(savedTheme) ? savedTheme : this.DEFAULT_THEME;

    this.themeSubject.next(theme);
    this.applyTheme(theme);
  }

  /**
   * Listen for system theme changes
   */
  private setupSystemThemeListener(): void {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Listen for changes using modern event listener
    const handleChange = () => {
      if (this.themeSubject.value === 'system') {
        this.updateResolvedTheme();
        this.updateMetaThemeColor();
      }
    };

    // Use addEventListener for modern browsers
    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      this.mediaQuery.addListener(handleChange);
    }
  }

  /**
   * Get current theme preference
   */
  getTheme(): Theme {
    return this.themeSubject.value;
  }

  /**
   * Get resolved theme (actual light/dark being displayed)
   */
  getResolvedTheme(): ResolvedTheme {
    return this.resolvedThemeSubject.value;
  }

  /**
   * Set theme preference
   */
  setTheme(theme: Theme): void {
    if (!this.isValidTheme(theme)) return;

    if (theme !== this.themeSubject.value) {
      this.themeSubject.next(theme);

      if (this.isBrowser) {
        localStorage.setItem(this.STORAGE_KEY, theme);
        this.applyTheme(theme);
      }
    }
  }

  /**
   * Toggle between light and dark (skips system)
   */
  toggleTheme(): void {
    const current = this.resolvedThemeSubject.value;
    this.setTheme(current === 'light' ? 'dark' : 'light');
  }

  /**
   * Cycle through all themes: light -> dark -> system -> light
   */
  cycleTheme(): void {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(this.themeSubject.value);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.setTheme(themes[nextIndex]);
  }

  /**
   * Apply theme to DOM
   */
  private applyTheme(theme: Theme): void {
    const html = document.documentElement;

    // Add transition class for smooth theme change
    html.classList.add('theme-transitioning');

    // Apply theme attribute
    html.setAttribute('data-theme', theme);

    // Update resolved theme
    this.updateResolvedTheme();

    // Update meta theme-color for mobile browsers
    this.updateMetaThemeColor();

    // Remove transition class after animation completes
    setTimeout(() => {
      html.classList.remove('theme-transitioning');
    }, 300);
  }

  /**
   * Calculate and update the resolved (actual) theme
   */
  private updateResolvedTheme(): void {
    let resolved: ResolvedTheme;

    if (this.themeSubject.value === 'system') {
      resolved = this.getSystemPreference();
    } else {
      resolved = this.themeSubject.value as ResolvedTheme;
    }

    this.resolvedThemeSubject.next(resolved);
  }

  /**
   * Get system color scheme preference
   */
  private getSystemPreference(): ResolvedTheme {
    if (this.mediaQuery) {
      return this.mediaQuery.matches ? 'dark' : 'light';
    }
    return 'light';
  }

  /**
   * Update mobile browser theme color
   */
  private updateMetaThemeColor(): void {
    const resolved = this.resolvedThemeSubject.value;
    const color = resolved === 'dark' ? '#161b22' : '#ffffff';

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
  }

  /**
   * Validate theme value
   */
  private isValidTheme(theme: string | null): theme is Theme {
    return theme === 'light' || theme === 'dark' || theme === 'system';
  }

  /**
   * Check if dark mode is active
   */
  isDarkMode(): boolean {
    return this.resolvedThemeSubject.value === 'dark';
  }

  /**
   * Check if using system theme
   */
  isSystemTheme(): boolean {
    return this.themeSubject.value === 'system';
  }
}
