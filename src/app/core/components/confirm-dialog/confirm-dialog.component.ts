import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ConfirmDialogService, ConfirmOptions } from '../../services/confirm-dialog.service';

/**
 * Single host for the app's confirmation dialog. Mount once at the app root.
 * Provides focus trapping, Escape-to-cancel, backdrop dismiss, and focus
 * restoration — an accessible replacement for the native confirm().
 */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  options: ConfirmOptions | null = null;

  @ViewChild('dialog') dialogRef?: ElementRef<HTMLElement>;

  private sub = new Subscription();
  private previouslyFocused: HTMLElement | null = null;

  constructor(private confirmDialog: ConfirmDialogService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.sub.add(
      this.confirmDialog.active$.subscribe(active => {
        if (active) {
          this.previouslyFocused = document.activeElement as HTMLElement | null;
          this.options = active;
          this.cdr.markForCheck();
          // Focus the primary action once the dialog is rendered.
          setTimeout(() => this.focusInitial(), 0);
        } else {
          this.options = null;
          this.cdr.markForCheck();
          // Restore focus to whatever was focused before the dialog opened.
          const toRestore = this.previouslyFocused;
          this.previouslyFocused = null;
          if (toRestore && typeof toRestore.focus === 'function') {
            setTimeout(() => toRestore.focus(), 0);
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  onConfirm(): void {
    this.confirmDialog.confirm();
  }

  onCancel(): void {
    this.confirmDialog.cancel();
  }

  onBackdropClick(event: MouseEvent): void {
    // Only dismiss when the backdrop itself (not the dialog) is clicked.
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.onCancel();
      return;
    }
    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  private focusableElements(): HTMLElement[] {
    const root = this.dialogRef?.nativeElement;
    if (!root) {
      return [];
    }
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.hasAttribute('disabled'));
  }

  private focusInitial(): void {
    const els = this.focusableElements();
    // Prefer the confirm button (marked data-confirm) so Enter confirms.
    const confirmBtn = els.find(el => el.hasAttribute('data-confirm'));
    (confirmBtn ?? els[0])?.focus();
  }

  private trapFocus(event: KeyboardEvent): void {
    const els = this.focusableElements();
    if (els.length === 0) {
      return;
    }
    const first = els[0];
    const last = els[els.length - 1];
    const activeEl = document.activeElement as HTMLElement | null;

    if (event.shiftKey && activeEl === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeEl === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
