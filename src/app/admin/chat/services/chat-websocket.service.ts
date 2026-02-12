import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WsEvent } from '../models/chat.model';

@Injectable({
  providedIn: 'root'
})
export class ChatWebsocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  private messagesSubject = new Subject<WsEvent>();
  private connectedSubject = new BehaviorSubject<boolean>(false);
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private reconnectTimer: any;
  private heartbeatTimer: any;
  private intentionalClose = false;

  messages$: Observable<WsEvent> = this.messagesSubject.asObservable();
  connected$: Observable<boolean> = this.connectedSubject.asObservable();

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = environment.chatWsToken;
    if (!token) {
      return;
    }

    this.intentionalClose = false;
    const wsUrl = this.buildWsUrl(token);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.connectedSubject.next(true);
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as WsEvent;
        this.messagesSubject.next(data);
      } catch {
        // Ignore malformed messages (pong responses, etc.)
      }
    };

    this.ws.onclose = () => {
      this.connectedSubject.next(false);
      this.stopHeartbeat();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  send(event: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectedSubject.next(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.messagesSubject.complete();
    this.connectedSubject.complete();
  }

  private buildWsUrl(token: string): string {
    const base = environment.chatWsUrl
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://');
    return `${base}/crm/ws?token=${encodeURIComponent(token)}`;
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
