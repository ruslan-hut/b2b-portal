import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  ViewChild,
  forwardRef,
  inject
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { isBlankHtml, sanitizeHtml } from '../../../core/utils/html-sanitize';

/** A toolbar entry. `state` is the execCommand queried for the pressed look. */
interface ToolbarButton {
  command: string;
  icon: string;
  labelKey: string;
  /** Rendered instead of an icon — the heading buttons read "H2" / "H3". */
  text?: string;
  argument?: string;
}

const INLINE_BUTTONS: ToolbarButton[] = [
  { command: 'bold', icon: 'format_bold', labelKey: 'richText.bold' },
  { command: 'italic', icon: 'format_italic', labelKey: 'richText.italic' },
  { command: 'underline', icon: 'format_underlined', labelKey: 'richText.underline' }
];

const BLOCK_BUTTONS: ToolbarButton[] = [
  { command: 'formatBlock', argument: 'h2', icon: '', text: 'H2', labelKey: 'richText.heading2' },
  { command: 'formatBlock', argument: 'h3', icon: '', text: 'H3', labelKey: 'richText.heading3' }
];

const LIST_BUTTONS: ToolbarButton[] = [
  { command: 'insertUnorderedList', icon: 'format_list_bulleted', labelKey: 'richText.bulletList' },
  { command: 'insertOrderedList', icon: 'format_list_numbered', labelKey: 'richText.numberedList' }
];

/**
 * The formatting surface for authored HTML — bold, italic, lists, links.
 *
 * A contenteditable div rather than a library: the vocabulary it has to produce
 * is fixed by `backend/internal/lib/htmlsafe`, so an editor whose schema is
 * wider would only be a schema to map back down, and one whose schema is
 * narrower would silently drop tags the Notion import already produces.
 *
 * Two things this must never do, because the sanitiser would undo both on save
 * and the editor would see their work disappear:
 * - **`styleWithCSS` stays off.** With it on the browser emits
 *   `<span style="font-weight:bold">`, and `style` is not an allowed attribute.
 * - **Pasted markup is sanitised at the paste**, not left for the server. What
 *   is on screen and what gets stored have to be the same thing.
 *
 * The source toggle is not a debug affordance: imported pages arrive as markup
 * an editor sometimes needs to correct by hand (a stray table cell, a link the
 * WYSIWYG cannot select), and hiding the HTML behind a library is what makes
 * that a support request.
 *
 * `document.execCommand` is formally deprecated and has no replacement — every
 * browser still implements it, and the alternative is hand-rolling selection
 * surgery for six commands.
 */
@Component({
  selector: 'app-rich-text',
  templateUrl: './rich-text.component.html',
  styleUrls: ['./rich-text.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextComponent),
      multi: true
    }
  ]
})
export class RichTextComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private host = inject(ElementRef<HTMLElement>);

  @ViewChild('surface') private surfaceRef?: ElementRef<HTMLDivElement>;

  /** Rows the editing surface is sized to before it grows with its content. */
  @Input() rows = 8;

  readonly inlineButtons = INLINE_BUTTONS;
  readonly blockButtons = BLOCK_BUTTONS;
  readonly listButtons = LIST_BUTTONS;

  /** Which commands are on at the caret, keyed by command + argument. */
  active: Record<string, boolean> = {};

  showSource = false;
  linkOpen = false;
  linkUrl = '';
  disabled = false;

  private value = '';

  /**
   * The selection the link row will apply to.
   *
   * Typing in the URL field moves focus out of the surface and the selection
   * with it, so the range has to be held from the moment the row opens.
   */
  private savedRange: Range | null = null;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  private readonly onSelectionChange = () => this.syncActive();

  ngAfterViewInit(): void {
    this.renderValue();
    // Outside Angular: selectionchange fires on every caret move, and only a
    // change in the pressed buttons is worth a change-detection pass.
    this.zone.runOutsideAngular(() => {
      document.addEventListener('selectionchange', this.onSelectionChange);
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('selectionchange', this.onSelectionChange);
  }

  // --- ControlValueAccessor ---------------------------------------------------

  writeValue(value: string | null): void {
    this.value = value || '';
    this.renderValue();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.cdr.markForCheck();
  }

  // --- editing ----------------------------------------------------------------

  get sourceValue(): string {
    return this.value;
  }

  /**
   * Writes the model into the surface.
   *
   * Guarded on equality because assigning `innerHTML` collapses the selection:
   * without the guard every keystroke would send the caret to the start.
   */
  private renderValue(): void {
    const surface = this.surfaceRef?.nativeElement;
    if (!surface || surface.innerHTML === this.value) {
      return;
    }
    surface.innerHTML = this.value;
  }

  onInput(): void {
    const surface = this.surfaceRef?.nativeElement;
    if (!surface) {
      return;
    }
    this.emit(isBlankHtml(surface.innerHTML) ? '' : sanitizeHtml(surface.innerHTML));
  }

  onSourceInput(event: Event): void {
    const raw = (event.target as HTMLTextAreaElement).value;
    this.value = raw;
    this.onChange(raw);
  }

  /** Leaving the source view is where hand-typed markup gets cleaned. */
  toggleSource(): void {
    this.showSource = !this.showSource;
    this.linkOpen = false;
    if (!this.showSource) {
      this.value = isBlankHtml(this.value) ? '' : sanitizeHtml(this.value);
      this.onChange(this.value);
      this.renderValue();
    }
  }

  onBlur(): void {
    this.onTouched();
  }

  /**
   * Foreign markup is cleaned before it reaches the surface.
   *
   * Falls back to the plain-text flavour when a source offers no HTML, with
   * blank lines becoming paragraphs — pasting a plain-text document as one
   * unbroken run is the thing an editor notices last.
   */
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const data = event.clipboardData;
    if (!data) {
      return;
    }

    const html = data.getData('text/html');
    const clean = html
      ? sanitizeHtml(html)
      : this.plainTextToHtml(data.getData('text/plain'));

    if (clean) {
      document.execCommand('insertHTML', false, clean);
      this.onInput();
    }
  }

  private plainTextToHtml(text: string): string {
    if (!text.trim()) {
      return '';
    }
    return text
      .split(/\n{2,}/)
      .map(part => `<p>${this.escape(part).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  private escape(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // --- commands ---------------------------------------------------------------

  buttonKey(button: ToolbarButton): string {
    return button.argument ? `${button.command}:${button.argument}` : button.command;
  }

  /**
   * Runs a command against the surface's selection.
   *
   * A heading button toggles: pressing H2 inside an H2 returns the block to a
   * paragraph, which is the only way back out without the source view.
   */
  run(button: ToolbarButton): void {
    const surface = this.surfaceRef?.nativeElement;
    if (!surface || this.disabled) {
      return;
    }
    surface.focus();
    document.execCommand('styleWithCSS', false, 'false');

    if (button.command === 'formatBlock') {
      // Angle brackets: Chrome accepts a bare tag name, Firefox historically
      // did not, and `<h2>` is understood everywhere.
      const on = this.active[this.buttonKey(button)];
      document.execCommand('formatBlock', false, on ? '<p>' : `<${button.argument}>`);
    } else {
      document.execCommand(button.command, false, button.argument);
    }

    this.onInput();
    this.syncActive();
  }

  /** Drops inline formatting and any link over the selection. */
  clearFormat(): void {
    const surface = this.surfaceRef?.nativeElement;
    if (!surface || this.disabled) {
      return;
    }
    surface.focus();
    document.execCommand('removeFormat');
    document.execCommand('unlink');
    this.onInput();
    this.syncActive();
  }

  openLink(): void {
    if (this.disabled) {
      return;
    }
    const selection = document.getSelection();
    this.savedRange = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    this.linkUrl = this.currentLinkHref();
    this.linkOpen = true;
  }

  cancelLink(): void {
    this.linkOpen = false;
    this.savedRange = null;
  }

  applyLink(): void {
    const surface = this.surfaceRef?.nativeElement;
    const url = this.linkUrl.trim();
    if (!surface) {
      return;
    }

    surface.focus();
    if (this.savedRange) {
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(this.savedRange);
    }

    if (url) {
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand('unlink');
    }

    // The sanitiser has the final word on the scheme, so a javascript: URL
    // typed here is stripped rather than trusted.
    this.onInput();
    this.renderValue();
    this.linkOpen = false;
    this.savedRange = null;
    this.syncActive();
  }

  private currentLinkHref(): string {
    const node = document.getSelection()?.anchorNode;
    const surface = this.surfaceRef?.nativeElement;
    if (!node || !surface || !surface.contains(node)) {
      return '';
    }
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return el?.closest('a')?.getAttribute('href') || '';
  }

  // --- toolbar state ----------------------------------------------------------

  private syncActive(): void {
    const surface = this.surfaceRef?.nativeElement;
    const node = document.getSelection()?.anchorNode;
    if (!surface || !node || !surface.contains(node)) {
      return;
    }

    const next: Record<string, boolean> = {};
    for (const button of [...this.inlineButtons, ...this.listButtons]) {
      next[button.command] = this.queryState(button.command);
    }
    const block = (document.queryCommandValue('formatBlock') || '').toLowerCase();
    for (const button of this.blockButtons) {
      next[this.buttonKey(button)] = block === button.argument;
    }

    if (JSON.stringify(next) === JSON.stringify(this.active)) {
      return;
    }
    this.zone.run(() => {
      this.active = next;
      this.cdr.markForCheck();
    });
  }

  private queryState(command: string): boolean {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }

  /**
   * Publishes a new value and re-announces it as a bubbling `input` event.
   *
   * The page editor tracks unsaved work with one host listener on `input`
   * rather than a binding per field. A toolbar click reaches the model through
   * `execCommand`, whose own input event is not something to rely on for the
   * "you have unsaved changes" guard — so the change is stated here explicitly.
   */
  private emit(html: string): void {
    if (html === this.value) {
      return;
    }
    this.value = html;
    this.onChange(html);
    this.host.nativeElement.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
