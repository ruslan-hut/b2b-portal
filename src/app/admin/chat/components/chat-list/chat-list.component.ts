import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ChatSummary, Platform } from '../../models/chat.model';

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.component.html',
  styleUrl: './chat-list.component.scss',
  standalone: false
})
export class ChatListComponent {
  @Input() chats: ChatSummary[] = [];
  @Input() activeChat: { platform: Platform; userId: string } | null = null;
  @Output() selectChat = new EventEmitter<{ platform: Platform; userId: string }>();

  isActive(chat: ChatSummary): boolean {
    return this.activeChat !== null
      && this.activeChat.platform === chat.platform
      && this.activeChat.userId === chat.user_id;
  }

  onSelect(chat: ChatSummary): void {
    this.selectChat.emit({ platform: chat.platform, userId: chat.user_id });
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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;

    if (date.toDateString() === new Date(now.getTime() - 86400000).toDateString()) {
      return 'yesterday';
    }

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
