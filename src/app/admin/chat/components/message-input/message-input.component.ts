import { Component, EventEmitter, Output, ViewChild, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-message-input',
  templateUrl: './message-input.component.html',
  styleUrl: './message-input.component.scss',
  standalone: false
})
export class MessageInputComponent implements AfterViewInit {
  @Output() send = new EventEmitter<string>();
  @ViewChild('textarea') textareaRef!: ElementRef<HTMLTextAreaElement>;

  text = '';

  ngAfterViewInit(): void {
    this.adjustHeight();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  onInput(): void {
    this.adjustHeight();
  }

  onSend(): void {
    const trimmed = this.text.trim();
    if (!trimmed) return;
    this.send.emit(trimmed);
    this.text = '';
    this.adjustHeight();
  }

  private adjustHeight(): void {
    const el = this.textareaRef?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }
}
