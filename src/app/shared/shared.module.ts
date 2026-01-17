import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { CurrencyFormatPipe } from '../core/pipes/currency-format.pipe';
import { LanguageSwitcherComponent } from '../core/components/language-switcher/language-switcher.component';
import { ThemeToggleComponent } from '../core/components/theme-toggle/theme-toggle.component';
import { UpdateNotificationComponent } from '../core/components/update-notification/update-notification.component';
import { ActionBarComponent } from './components/action-bar/action-bar.component';

/**
 * SharedModule contains declarations (pipes, components) that are shared across feature modules.
 * Import this module in feature modules that need access to shared components/pipes.
 *
 * Note: CoreModule should only be imported in AppModule as it contains providers.
 */
@NgModule({
  declarations: [
    TranslatePipe,
    CurrencyFormatPipe,
    LanguageSwitcherComponent,
    ThemeToggleComponent,
    UpdateNotificationComponent,
    ActionBarComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule
  ],
  exports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    CurrencyFormatPipe,
    LanguageSwitcherComponent,
    ThemeToggleComponent,
    UpdateNotificationComponent,
    ActionBarComponent
  ]
})
export class SharedModule { }
