import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ChatSummary, ChatMessage, Platform } from '../models/chat.model';
import { ChatWebsocketService } from './chat-websocket.service';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly baseUrl = `${environment.chatWsUrl}/crm`;

  private chatsSubject = new BehaviorSubject<ChatSummary[]>([]);
  chats$ = this.chatsSubject.asObservable();

  totalUnread$: Observable<number> = this.chats$.pipe(
    map(chats => chats.reduce((sum, c) => sum + c.unread, 0))
  );

  private activeChatKey: string | null = null;

  constructor(
    private http: HttpClient,
    private wsService: ChatWebsocketService
  ) {}

  loadChats(): void {
    this.http.get<ApiResponse<ChatSummary[]>>(`${this.baseUrl}/chats`, {
      headers: this.authHeaders()
    }).pipe(
      map(response => response.data || [])
    ).subscribe({
      next: chats => {
        this.chatsSubject.next(
          chats.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime())
        );
      },
      error: () => {
        // Chats will remain empty; API may not be ready yet
      }
    });
  }

  setActiveChat(platform: Platform, userId: string): void {
    this.activeChatKey = `${platform}:${userId}`;
  }

  clearActiveChat(): void {
    this.activeChatKey = null;
  }

  getChatSnapshot(platform: Platform, userId: string): ChatSummary | undefined {
    return this.chatsSubject.value.find(c => c.platform === platform && c.user_id === userId);
  }

  handleNewMessage(msg: ChatMessage): void {
    const chats = this.chatsSubject.value;
    const msgKey = `${msg.platform}:${msg.user_id}`;
    const idx = chats.findIndex(c => c.platform === msg.platform && c.user_id === msg.user_id);

    if (idx >= 0) {
      const chat = { ...chats[idx] };
      chat.last_message = msg.text;
      chat.last_time = msg.created_at;
      if (msg.direction === 'incoming' && this.activeChatKey !== msgKey) {
        chat.unread++;
      }
      const updated = [...chats];
      updated.splice(idx, 1);
      updated.unshift(chat);
      this.chatsSubject.next(updated);
    } else {
      const newChat: ChatSummary = {
        platform: msg.platform,
        user_id: msg.user_id,
        user_name: msg.sender,
        last_message: msg.text,
        last_time: msg.created_at,
        unread: msg.direction === 'incoming' && this.activeChatKey !== msgKey ? 1 : 0
      };
      this.chatsSubject.next([newChat, ...chats]);
    }
  }

  resetUnread(platform: Platform, userId: string): void {
    const chats = this.chatsSubject.value;
    const idx = chats.findIndex(c => c.platform === platform && c.user_id === userId);
    if (idx >= 0 && chats[idx].unread > 0) {
      const updated = [...chats];
      updated[idx] = { ...updated[idx], unread: 0 };
      this.chatsSubject.next(updated);
    }

    this.wsService.send({
      type: 'mark_read',
      data: { platform, user_id: userId }
    });
  }

  getMessages(platform: Platform, userId: string, limit = 50, offset = 0): Observable<ChatMessage[]> {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    return this.http.get<ApiResponse<ChatMessage[]>>(
      `${this.baseUrl}/chats/${platform}/${userId}/messages`,
      { params, headers: this.authHeaders() }
    ).pipe(
      map(response => response.data || [])
    );
  }

  sendMessage(platform: Platform, userId: string, text: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.baseUrl}/chats/${platform}/${userId}/send`,
      { text },
      { headers: this.authHeaders() }
    );
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${environment.chatWsToken}`
    });
  }
}
