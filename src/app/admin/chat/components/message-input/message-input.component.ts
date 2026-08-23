import { Component, EventEmitter, Output, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { TranslationService } from '../../../../core/services/translation.service';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB — must match backend entity.MaxFileSize

@Component({
  selector: 'app-message-input',
  templateUrl: './message-input.component.html',
  styleUrl: './message-input.component.scss',
  standalone: false
})
export class MessageInputComponent implements AfterViewInit {
  @Output() send = new EventEmitter<string>();
  @Output() sendFiles = new EventEmitter<{ files: File[]; caption: string }>();
  @ViewChild('textarea') textareaRef!: ElementRef<HTMLTextAreaElement>;

  text = '';
  selectedFiles: File[] = [];
  filePreviews: string[] = [];
  fileSizeError = '';

  constructor(private translationService: TranslationService) {}

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

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.fileSizeError = '';
    for (const file of Array.from(input.files)) {
      if (file.size > MAX_FILE_SIZE) {
        const limitMB = MAX_FILE_SIZE / (1024 * 1024);
        this.fileSizeError = this.translationService.instant('chat.fileTooLarge', {
          name: file.name,
          limit: limitMB
        });
        continue;
      }
      this.selectedFiles.push(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => this.filePreviews.push(e.target!.result as string);
        reader.readAsDataURL(file);
      } else {
        this.filePreviews.push('');
      }
    }
    input.value = '';
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.filePreviews.splice(index, 1);
  }

  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  onSend(): void {
    const trimmed = this.text.trim();
    if (this.selectedFiles.length) {
      this.sendFiles.emit({ files: [...this.selectedFiles], caption: trimmed });
      this.selectedFiles = [];
      this.filePreviews = [];
      this.text = '';
      this.adjustHeight();
    } else if (trimmed) {
      this.send.emit(trimmed);
      this.text = '';
      this.adjustHeight();
    }
  }

  private adjustHeight(): void {
    const el = this.textareaRef?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }
}
