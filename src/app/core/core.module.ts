import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from './pipes/translate.pipe';
import { LanguageSwitcherComponent } from './components/language-switcher/language-switcher.component';

@NgModule({
  declarations: [
    TranslatePipe,
    LanguageSwitcherComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    TranslatePipe,
    LanguageSwitcherComponent
  ]
})
export class CoreModule { }

