import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnChanges, SimpleChanges, AfterViewChecked } from '@angular/core';
import { ChatMessage, Platform } from '../../models/chat.model';
import { TranslationService } from '../../../../core/services/translation.service';

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
export class ChatWindowComponent implements OnChanges, AfterViewChecked {
  @Input() messages: ChatMessage[] = [];
  @Input() activeChat: { platform: Platform; userId: string; userName?: string } | null = null;
  @Input() loading = false;
  @Input() typingIndicator = false;
  @Input() wsConnected = true;

  @Output() loadMore = new EventEmitter<void>();
  @Output() sendMessage = new EventEmitter<string>();
  @Output() goBack = new EventEmitter<void>();

  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;

  dateGroups: DateGroup[] = [];
  private shouldScrollToBottom = false;
  private prevMessageCount = 0;

  constructor(private translationService: TranslationService) {}

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
      this.shouldScrollToBottom = false;
    }
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

  onBack(): void {
    this.goBack.emit();
  }

  getPlatformIcon(platform: Platform): string {
    switch (platform) {
      case 'telegram': return 'send';
      case 'instagram': return 'camera_alt';
      case 'whatsapp': return 'phone';
    }
  }

  getPlatformClass(platform: Platform): string {
    return `platform-${platform}`;
  }

  formatTime(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
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
        const d = new Date(key);
        label = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
      }
      result.push({ label, messages: msgs });
    }

    return result;
  }
}
