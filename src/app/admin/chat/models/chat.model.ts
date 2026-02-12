export type Platform = 'telegram' | 'instagram' | 'whatsapp';

export interface ChatSummary {
  platform: Platform;
  user_id: string;
  user_name: string;
  last_message: string;
  last_time: string;
  unread: number;
}

export interface ChatMessage {
  id: string;
  platform: Platform;
  user_id: string;
  direction: 'incoming' | 'outgoing';
  sender: string;
  text: string;
  created_at: string;
}

export interface WsNewMessageEvent {
  type: 'new_message';
  data: ChatMessage;
}

export interface WsTypingEvent {
  type: 'typing';
  data: { platform: Platform; user_id: string };
}

export type WsEvent = WsNewMessageEvent | WsTypingEvent;
