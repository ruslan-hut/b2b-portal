import { Component, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';
import { ThemeService, Theme, ResolvedTheme } from '../../services/theme.service';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrls: ['./theme-toggle.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeToggleComponent {
  theme$: Observable<Theme>;
  resolvedTheme$: Observable<ResolvedTheme>;
  isDropdownOpen = false;

  themes: { value: Theme; labelKey: string; icon: string }[] = [
    { value: 'light', labelKey: 'theme.light', icon: 'light_mode' },
    { value: 'dark', labelKey: 'theme.dark', icon: 'dark_mode' },
    { value: 'system', labelKey: 'theme.system', icon: 'settings_brightness' }
  ];

  constructor(
    private themeService: ThemeService,
    public translationService: TranslationService
  ) {
    this.theme$ = this.themeService.theme$;
    this.resolvedTheme$ = this.themeService.resolvedTheme$;
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  selectTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
    this.closeDropdown();
  }

  getCurrentTheme(): Theme {
    return this.themeService.getTheme();
  }

  getThemeIcon(): string {
    const theme = this.themeService.getTheme();
    if (theme === 'system') {
      return 'settings_brightness';
    }
    const resolved = this.themeService.getResolvedTheme();
    return resolved === 'dark' ? 'dark_mode' : 'light_mode';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clickedInside = target.closest('.theme-toggle-wrapper');
    if (!clickedInside) {
      this.closeDropdown();
    }
  }
}
