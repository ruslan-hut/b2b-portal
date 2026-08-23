import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, EMPTY } from 'rxjs';
import { map } from 'rxjs/operators';
import { ChatSettingsService } from './chat-settings.service';
import { ChatSummary, ChatMessage } from '../models/chat.model';
import { ChatWebsocketService } from './chat-websocket.service';
import { ApiResponse } from '../../../core/models/api.model';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private chatsSubject = new BehaviorSubject<ChatSummary[]>([]);
  chats$ = this.chatsSubject.asObservable();

  totalUnread$: Observable<number> = this.chats$.pipe(
    map(chats => chats.reduce((sum, c) => sum + c.unread, 0))
  );

  private activeChatKey: string | null = null;
  private allChats: ChatSummary[] = [];
  private displayCount = 0;
  private _unreadOnly = false;
  private _loadingUnread = false;

  readonly CHATS_PAGE_SIZE = 100;
  hasMoreChats = false;

  get unreadOnly(): boolean { return this._unreadOnly; }
  get loadingUnread(): boolean { return this._loadingUnread; }

  constructor(
    private http: HttpClient,
    private wsService: ChatWebsocketService,
    private chatSettingsService: ChatSettingsService
  ) {}

  private getBaseUrl(): string {
    const config = this.chatSettingsService.getConfig();
    if (!config || !config.base_url) return '';
    return `${config.base_url}${config.chats_endpoint || '/crm/chats'}`;
  }

  private authHeaders(): HttpHeaders {
    const token = this.chatSettingsService.getAuthToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  loadChats(): void {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) return;

    this.http.get<ApiResponse<ChatSummary[]>>(baseUrl, {
      headers: this.authHeaders()
    }).pipe(
      map(response => response.data || [])
    ).subscribe({
      next: chats => {
        this.allChats = chats.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());
        this.displayCount = Math.min(this.CHATS_PAGE_SIZE, this.allChats.length);
        this.hasMoreChats = this.displayCount < this.allChats.length;
        this.chatsSubject.next(this.allChats.slice(0, this.displayCount));
      },
      error: () => {
        // Chats will remain empty; API may not be ready yet
      }
    });
  }

  loadMoreChats(): void {
    if (!this.hasMoreChats) return;

    this.displayCount = Math.min(this.displayCount + this.CHATS_PAGE_SIZE, this.allChats.length);
    this.hasMoreChats = this.displayCount < this.allChats.length;
    this.chatsSubject.next(this.allChats.slice(0, this.displayCount));
  }

  showUnreadChats(): void {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) return;

    this._unreadOnly = true;
    this._loadingUnread = true;

    this.http.get<ApiResponse<ChatSummary[]>>(baseUrl, {
      headers: this.authHeaders()
    }).pipe(
      map(response => response.data || [])
    ).subscribe({
      next: chats => {
        const sorted = chats.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());
        // Update allChats with fresh data
        this.allChats = sorted;
        // Emit only unread, no pagination limit
        this.chatsSubject.next(sorted.filter(c => c.unread > 0));
        this.hasMoreChats = false;
        this._loadingUnread = false;
      },
      error: () => {
        this._loadingUnread = false;
      }
    });
  }

  showAllChats(): void {
    this._unreadOnly = false;
    this.displayCount = Math.min(this.CHATS_PAGE_SIZE, this.allChats.length);
    this.hasMoreChats = this.displayCount < this.allChats.length;
    this.chatsSubject.next(this.allChats.slice(0, this.displayCount));
  }

  setActiveChat(platform: string, userId: string): void {
    this.activeChatKey = `${platform}:${userId}`;
  }

  clearActiveChat(): void {
    this.activeChatKey = null;
  }

  getAllChats(): ChatSummary[] {
    return this.allChats;
  }

  getChatSnapshot(platform: string, userId: string): ChatSummary | undefined {
    return this.allChats.find(c => c.platform === platform && c.user_id === userId);
  }

  handleNewMessage(msg: ChatMessage): void {
    const msgKey = `${msg.platform}:${msg.user_id}`;
    const idx = this.allChats.findIndex(c => c.platform === msg.platform && c.user_id === msg.user_id);

    if (idx >= 0) {
      const chat = { ...this.allChats[idx] };
      chat.last_message = msg.text || (msg.attachments?.length ? `[${msg.attachments.length} file(s)]` : '');
      chat.last_time = msg.created_at;
      if (msg.user_name) chat.user_name = msg.user_name;
      if (msg.messenger_name) chat.messenger_name = msg.messenger_name;
      if (msg.direction === 'incoming' && this.activeChatKey !== msgKey) {
        chat.unread++;
      }
      this.allChats = [chat, ...this.allChats.filter((_, i) => i !== idx)];
    } else {
      const newChat: ChatSummary = {
        platform: msg.platform,
        user_id: msg.user_id,
        user_name: msg.user_name || '',
        messenger_name: msg.messenger_name,
        last_message: msg.text || (msg.attachments?.length ? `[${msg.attachments.length} file(s)]` : ''),
        last_time: msg.created_at,
        unread: msg.direction === 'incoming' && this.activeChatKey !== msgKey ? 1 : 0
      };
      this.allChats = [newChat, ...this.allChats];
      this.displayCount++;
    }

    this.emitChats();
  }

  resetUnread(platform: string, userId: string): void {
    const idx = this.allChats.findIndex(c => c.platform === platform && c.user_id === userId);
    if (idx >= 0 && this.allChats[idx].unread > 0) {
      this.allChats = [...this.allChats];
      this.allChats[idx] = { ...this.allChats[idx], unread: 0 };
      this.emitChats();
    }

    this.wsService.send({
      type: 'mark_read',
      data: { platform, user_id: userId }
    });
  }

  private emitChats(): void {
    if (this._unreadOnly) {
      this.chatsSubject.next(this.allChats.filter(c => c.unread > 0));
      this.hasMoreChats = false;
    } else {
      this.hasMoreChats = this.displayCount < this.allChats.length;
      this.chatsSubject.next(this.allChats.slice(0, this.displayCount));
    }
  }

  getMessages(platform: string, userId: string, limit = 50, offset = 0): Observable<ChatMessage[]> {
    const config = this.chatSettingsService.getConfig();
    if (!config || !config.base_url) return EMPTY;

    const endpoint = (config.messages_endpoint || '/crm/chats/{platform}/{userId}/messages')
      .replace('{platform}', encodeURIComponent(platform))
      .replace('{userId}', encodeURIComponent(userId));

    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    return this.http.get<ApiResponse<ChatMessage[]>>(
      `${config.base_url}${endpoint}`,
      { params, headers: this.authHeaders() }
    ).pipe(
      map(response => response.data || [])
    );
  }

  sendMessage(platform: string, userId: string, text: string): Observable<{ ok: boolean }> {
    const config = this.chatSettingsService.getConfig();
    if (!config || !config.base_url) return EMPTY;

    const endpoint = (config.send_endpoint || '/crm/chats/{platform}/{userId}/send')
      .replace('{platform}', encodeURIComponent(platform))
      .replace('{userId}', encodeURIComponent(userId));

    return this.http.post<{ ok: boolean }>(
      `${config.base_url}${endpoint}`,
      { text },
      { headers: this.authHeaders() }
    );
  }

  sendFiles(platform: string, userId: string, files: File[], caption: string): Observable<any> {
    const config = this.chatSettingsService.getConfig();
    if (!config || !config.base_url) return EMPTY;

    const endpoint = '/crm/chats/{platform}/{userId}/send-file'
      .replace('{platform}', encodeURIComponent(platform))
      .replace('{userId}', encodeURIComponent(userId));

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file, file.name);
    }
    if (caption) {
      formData.append('caption', caption);
    }

    return this.http.post(
      `${config.base_url}${endpoint}`,
      formData,
      { headers: new HttpHeaders({ Authorization: `Bearer ${this.chatSettingsService.getAuthToken()}` }) }
    );
  }
}
