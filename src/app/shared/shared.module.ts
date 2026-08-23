import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { LocalizedStageNamePipe } from '../core/pipes/localized-stage-name.pipe';
import { CurrencyFormatPipe } from '../core/pipes/currency-format.pipe';
import { DateFormatPipe } from '../core/pipes/date-format.pipe';
import { ContentFileUrlPipe } from '../core/pipes/content-file-url.pipe';
import { LanguageSwitcherComponent } from '../core/components/language-switcher/language-switcher.component';
import { ThemeToggleComponent } from '../core/components/theme-toggle/theme-toggle.component';
import { UpdateNotificationComponent } from '../core/components/update-notification/update-notification.component';
import { MaintenanceBannerComponent } from '../core/components/maintenance-banner/maintenance-banner.component';
import { NotificationContainerComponent } from '../core/components/notification-container/notification-container.component';
import { ConfirmDialogComponent } from '../core/components/confirm-dialog/confirm-dialog.component';
import { ActionBarComponent } from './components/action-bar/action-bar.component';
import { MenuBarComponent } from './components/menu-bar/menu-bar.component';
import { PaginationComponent } from './components/pagination/pagination.component';
import { FilterCriterionComponent } from './components/filter-criterion/filter-criterion.component';
import { CopyOnClickDirective } from './directives/copy-on-click.directive';
import { ContentArticleComponent } from './components/content-article/content-article.component';
import { IconComponent } from './components/icon/icon.component';
import { RichTextComponent } from './components/rich-text/rich-text.component';

/**
 * SharedModule contains declarations (pipes, components) that are shared across feature modules.
 * Import this module in feature modules that need access to shared components/pipes.
 *
 * Note: CoreModule should only be imported in AppModule as it contains providers.
 */
@NgModule({
  declarations: [
    TranslatePipe,
    LocalizedStageNamePipe,
    CurrencyFormatPipe,
    DateFormatPipe,
    ContentFileUrlPipe,
    LanguageSwitcherComponent,
    ThemeToggleComponent,
    UpdateNotificationComponent,
    MaintenanceBannerComponent,
    NotificationContainerComponent,
    ConfirmDialogComponent,
    ActionBarComponent,
    MenuBarComponent,
    PaginationComponent,
    FilterCriterionComponent,
    CopyOnClickDirective,
    ContentArticleComponent,
    IconComponent,
    RichTextComponent
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
    LocalizedStageNamePipe,
    CurrencyFormatPipe,
    DateFormatPipe,
    ContentFileUrlPipe,
    LanguageSwitcherComponent,
    ThemeToggleComponent,
    UpdateNotificationComponent,
    MaintenanceBannerComponent,
    NotificationContainerComponent,
    ConfirmDialogComponent,
    ActionBarComponent,
    MenuBarComponent,
    PaginationComponent,
    FilterCriterionComponent,
    CopyOnClickDirective,
    ContentArticleComponent,
    IconComponent,
    RichTextComponent
  ]
})
export class SharedModule { }
