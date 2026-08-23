import {
  ChangeDetectorRef,
  Directive,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  inject
} from '@angular/core';

@Directive({
  selector: '[copyOnClick]',
  standalone: false
})
export class CopyOnClickDirective implements OnDestroy {
  @Input('copyOnClick') value: string | number | null | undefined = '';

  @HostBinding('class.is-copied') copied = false;
  @HostBinding('attr.role') readonly role = 'button';
  @HostBinding('attr.tabindex') readonly tabindex = '0';

  private readonly cdr = inject(ChangeDetectorRef);
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  @HostBinding('attr.title')
  get title(): string {
    const text = this.text();
    if (!text) return '';
    return this.copied ? 'Copied' : `${text} — click to copy`;
  }

  @HostListener('click', ['$event'])
  onClick(event: Event): void {
    event.stopPropagation();
    this.copy();
  }

  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  onKey(event: Event): void {
    event.preventDefault();
    this.copy();
  }

  ngOnDestroy(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  private text(): string {
    return (this.value ?? '').toString().trim();
  }

  private copy(): void {
    const text = this.text();
    if (!text || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copied = true;
      this.cdr.markForCheck();
      if (this.resetTimer) clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => {
        this.copied = false;
        this.cdr.markForCheck();
      }, 1200);
    });
  }
}
