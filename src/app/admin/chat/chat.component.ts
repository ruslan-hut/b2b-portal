import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { ChatService } from './services/chat.service';
import { ChatWebsocketService } from './services/chat-websocket.service';
import { ChatSummary, ChatMessage, Platform, WsEvent } from './models/chat.model';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  standalone: false
})
export class ChatComponent implements OnInit, OnDestroy {
  chats$: Observable<ChatSummary[]>;
  activeChat: { platform: Platform; userId: string; userName?: string } | null = null;
  messages: ChatMessage[] = [];
  wsConnected = false;
  loading = false;
  typingIndicator = false;
  mobileShowChat = false;

  private subscriptions = new Subscription();
  private typingTimeout: any;
  private messageOffset = 0;
  private readonly PAGE_SIZE = 50;

  constructor(
    private chatService: ChatService,
    private wsService: ChatWebsocketService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {
    this.chats$ = this.chatService.chats$;
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.wsService.connected$.subscribe(connected => {
        this.wsConnected = connected;
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.wsService.messages$.subscribe(event => this.handleWsEvent(event))
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.chatService.clearActiveChat();
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
  }

  onSelectChat(event: { platform: Platform; userId: string }): void {
    const chat = this.chatService.getChatSnapshot(event.platform, event.userId);

    this.activeChat = {
      platform: event.platform,
      userId: event.userId,
      userName: chat?.user_name
    };
    this.messages = [];
    this.messageOffset = 0;
    this.mobileShowChat = true;

    this.chatService.setActiveChat(event.platform, event.userId);
    this.chatService.resetUnread(event.platform, event.userId);

    this.loadMessages();
  }

  onLoadMore(): void {
    if (this.loading || !this.activeChat) return;
    this.messageOffset += this.PAGE_SIZE;
    this.loadMessages(true);
  }

  onSendMessage(text: string): void {
    if (!this.activeChat) return;

    const optimistic: ChatMessage = {
      id: 'temp-' + Date.now(),
      platform: this.activeChat.platform,
      user_id: this.activeChat.userId,
      direction: 'outgoing',
      sender: this.translationService.instant('chat.manager'),
      text,
      created_at: new Date().toISOString()
    };

    this.messages = [...this.messages, optimistic];
    this.cdr.markForCheck();

    this.chatService.sendMessage(this.activeChat.platform, this.activeChat.userId, text).subscribe({
      error: () => {
        this.messages = this.messages.filter(m => m.id !== optimistic.id);
        this.cdr.markForCheck();
      }
    });
  }

  onGoBack(): void {
    this.mobileShowChat = false;
  }

  private loadMessages(prepend = false): void {
    if (!this.activeChat) return;
    this.loading = true;
    this.cdr.markForCheck();

    this.chatService.getMessages(
      this.activeChat.platform,
      this.activeChat.userId,
      this.PAGE_SIZE,
      this.messageOffset
    ).subscribe({
      next: msgs => {
          // API returns newest-first; reverse to chronological (oldest at top)
          const chronological = msgs.reverse();
          if (prepend) {
              this.messages = [...chronological, ...this.messages];
              } else {
              this.messages = chronological;
              }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private handleWsEvent(event: WsEvent): void {
    if (event.type === 'new_message') {
      const msg = event.data;

      // Only append to the active chat's message list
      if (this.activeChat
        && msg.platform === this.activeChat.platform
        && msg.user_id === this.activeChat.userId) {

        // Fix duplicate: if outgoing, replace the temp optimistic message
        if (msg.direction === 'outgoing') {
          const tempIdx = this.messages.findIndex(
            m => m.id.startsWith('temp-') && m.text === msg.text
          );
          if (tempIdx >= 0) {
            const updated = [...this.messages];
            updated[tempIdx] = msg;
            this.messages = updated;
          } else {
            this.messages = [...this.messages, msg];
          }
        } else {
          this.messages = [...this.messages, msg];
        }

        this.typingIndicator = false;
      }

      this.cdr.markForCheck();
    }

    if (event.type === 'typing') {
      if (this.activeChat
        && event.data.platform === this.activeChat.platform
        && event.data.user_id === this.activeChat.userId) {
        this.typingIndicator = true;
        this.cdr.markForCheck();

        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
          this.typingIndicator = false;
          this.cdr.markForCheck();
        }, 3000);
      }
    }
  }
}
