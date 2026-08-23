import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';
import { ICONS, IconDef } from './icons';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * The one way to render an icon.
 *
 *   <app-icon name="package"></app-icon>
 *   <app-icon name="alert-triangle" size="lg" [label]="'…' | translate"></app-icon>
 *
 * Geometry comes from `icons.ts`. The svg inherits `color`, so an icon in a
 * danger row goes danger with the row.
 *
 * **Sizing is `font-size`, and the svg is 1em square.** That is deliberate: it
 * makes the component a drop-in for the `.material-icons` ligature it replaced,
 * so the hundreds of existing `.some-icon { font-size: 20px }` rules keep
 * sizing their icon after the swap. `size` picks an `--icon-*` token; a call
 * site needing something else sets `font-size` on the element as before.
 *
 * Decorative by default: without `label` the svg is `aria-hidden` and the
 * neighbouring text carries the meaning. Pass `label` only when the icon *is*
 * the label — an icon-only button.
 *
 * An unknown name renders nothing rather than a box: a typo should leave a gap
 * a reviewer notices, not a glyph that looks deliberate.
 */
@Component({
  selector: 'app-icon',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (def) {
      <svg
        viewBox="0 0 24 24"
        [attr.fill]="def.filled ? 'currentColor' : 'none'"
        [attr.stroke]="def.filled ? 'none' : 'currentColor'"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        [attr.role]="label ? 'img' : null"
        [attr.aria-label]="label || null"
        [attr.aria-hidden]="label ? null : 'true'"
        focusable="false"
      >
        @for (d of def.paths; track $index) {
          <path [attr.d]="d" />
        }
      </svg>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        line-height: 0;
        color: inherit;
        font-size: var(--icon-md);
      }

      :host(.app-icon--sm) { font-size: var(--icon-sm); }
      :host(.app-icon--lg) { font-size: var(--icon-lg); }
      :host(.app-icon--xl) { font-size: var(--icon-xl); }

      svg {
        width: 1em;
        height: 1em;
        display: block;
      }
    `,
  ],
})
export class IconComponent {
  @Input({ required: true }) name = '';
  @Input() size: IconSize = 'md';
  /** Accessible name. Set it only when no adjacent text says the same thing. */
  @Input() label?: string;

  /* Individual class bindings, not @HostBinding('class') — the latter replaces
     the element's whole class list and would drop the layout class a call site
     puts on the tag (`<app-icon class="menu-icon">`). */
  @HostBinding('class.app-icon') readonly hostClass = true;
  @HostBinding('class.app-icon--sm') get isSm(): boolean { return this.size === 'sm'; }
  @HostBinding('class.app-icon--md') get isMd(): boolean { return this.size === 'md'; }
  @HostBinding('class.app-icon--lg') get isLg(): boolean { return this.size === 'lg'; }
  @HostBinding('class.app-icon--xl') get isXl(): boolean { return this.size === 'xl'; }

  get def(): IconDef | undefined {
    return ICONS[this.name];
  }
}
