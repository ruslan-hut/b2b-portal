import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnChanges, SimpleChanges, AfterViewChecked, OnDestroy, NgZone } from '@angular/core';
import { ChatMessage, Platform, Attachment } from '../../models/chat.model';
import { TranslationService } from '../../../../core/services/translation.service';
import { ChatSettingsService } from '../../services/chat-settings.service';
import { formatDate, formatTimeShort } from '../../../../core/utils/date-format';

interface DateGroup {
  label: string;
  messages: ChatMessage[];
}

@Component({
  selector: 'app-chat-window',
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
  standalone: false
})
export class ChatWindowComponent implements OnChanges, AfterViewChecked, OnDestroy {
  @Input() messages: ChatMessage[] = [];
  @Input() activeChat: { platform: Platform; userId: string; userName?: string; messengerName?: string } | null = null;
  @Input() loading = false;
  @Input() typingIndicator = false;
  @Input() wsConnected = true;
  @Input() errorMessage = '';

  @Output() loadMore = new EventEmitter<void>();
  @Output() dismissError = new EventEmitter<void>();
  @Output() sendMessage = new EventEmitter<string>();
  @Output() sendFiles = new EventEmitter<{ files: File[]; caption: string }>();
  @Output() goBack = new EventEmitter<void>();

  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;

  dateGroups: DateGroup[] = [];
  private shouldScrollToBottom = false;
  private prevMessageCount = 0;

  private imageLoadListener = this.onImageLoad.bind(this);

  constructor(
    private translationService: TranslationService,
    private chatSettingsService: ChatSettingsService,
    private ngZone: NgZone
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages']) {
      this.dateGroups = this.groupByDate(this.messages);
      // Scroll to bottom on new messages appended (not on loadMore which prepends)
      if (this.messages.length > this.prevMessageCount && this.prevMessageCount > 0) {
        const diff = this.messages.length - this.prevMessageCount;
        // If only a few new messages arrived at the end, scroll down
        if (diff <= 5) {
          this.shouldScrollToBottom = true;
        }
      } else if (this.prevMessageCount === 0 && this.messages.length > 0) {
        // First load — scroll to bottom
        this.shouldScrollToBottom = true;
      }
      this.prevMessageCount = this.messages.length;
    }

    if (changes['activeChat'] && changes['activeChat'].currentValue !== changes['activeChat'].previousValue) {
      this.prevMessageCount = 0;
      this.shouldScrollToBottom = true;
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.observeImages();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.removeImageListeners();
  }

  onScroll(): void {
    const el = this.messagesContainer?.nativeElement;
    if (!el) return;
    if (el.scrollTop === 0 && this.messages.length > 0 && !this.loading) {
      this.loadMore.emit();
    }
  }

  onSend(text: string): void {
    this.sendMessage.emit(text);
    this.shouldScrollToBottom = true;
  }

  onSendFiles(event: { files: File[]; caption: string }): void {
    this.sendFiles.emit(event);
    this.shouldScrollToBottom = true;
  }

  onBack(): void {
    this.goBack.emit();
  }

  isImage(att: Attachment): boolean {
    return att.mimeType.startsWith('image/');
  }

  getFileUrl(att: Attachment): string {
    const config = this.chatSettingsService.getConfig();
    return `${config?.base_url || ''}${att.url}`;
  }

  getFileIcon(att: Attachment): string {
    if (att.mimeType.startsWith('image/')) return 'image';
    if (att.mimeType === 'application/pdf') return 'picture_as_pdf';
    if (att.mimeType.startsWith('audio/')) return 'audiotrack';
    if (att.mimeType.startsWith('video/')) return 'videocam';
    return 'insert_drive_file';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getPlatformIcon(platform: Platform): string {
    return this.chatSettingsService.getPlatformIcon(platform);
  }

  getPlatformClass(platform: Platform): string {
    return `platform-${platform}`;
  }

  formatTime(iso: string): string {
    return formatTimeShort(iso);
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  // Re-scroll when lazily loaded images expand the container height.
  private observeImages(): void {
    this.removeImageListeners();
    const el = this.messagesContainer?.nativeElement;
    if (!el) return;
    const images = el.querySelectorAll<HTMLImageElement>('img:not([data-scroll-bound])');
    images.forEach(img => {
      img.setAttribute('data-scroll-bound', '1');
      img.addEventListener('load', this.imageLoadListener);
    });
  }

  private removeImageListeners(): void {
    const el = this.messagesContainer?.nativeElement;
    if (!el) return;
    const images = el.querySelectorAll<HTMLImageElement>('img[data-scroll-bound]');
    images.forEach(img => {
      img.removeEventListener('load', this.imageLoadListener);
    });
  }

  private onImageLoad(): void {
    this.ngZone.run(() => this.scrollToBottom());
  }

  private groupByDate(messages: ChatMessage[]): DateGroup[] {
    const groups: Map<string, ChatMessage[]> = new Map();

    for (const msg of messages) {
      const date = new Date(msg.created_at);
      const key = date.toDateString();
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(msg);
    }

    const result: DateGroup[] = [];
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);

    for (const [key, msgs] of groups) {
      let label: string;
      if (key === today.toDateString()) {
        label = this.translationService.instant('chat.today');
      } else if (key === yesterday.toDateString()) {
        label = this.translationService.instant('chat.yesterday');
      } else {
        label = formatDate(key);
      }
      result.push({ label, messages: msgs });
    }

    return result;
  }
}
