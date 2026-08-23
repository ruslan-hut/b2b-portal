export type Platform = string;

export interface ChatSummary {
  platform: Platform;
  user_id: string;
  user_name: string;
  messenger_name?: string;
  last_message: string;
  last_time: string;
  unread: number;
}

export interface Attachment {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface ChatMessage {
  id: string;
  platform: Platform;
  user_name?: string;
  messenger_name?: string;
  user_id: string;
  direction: 'incoming' | 'outgoing';
  sender: string;
  text: string;
  created_at: string;
  attachments?: Attachment[];
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
