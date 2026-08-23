import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface ChatServicePlatform {
  id: string;
  name: string;
  enabled: boolean;
  base_url: string;
  icon: string;
}

export interface ChatServiceConfig {
  id: number;
  base_url: string;
  auth_token: string;
  auth_token_masked: string;
  has_auth_token: boolean;
  enabled: boolean;
  ws_endpoint: string;
  chats_endpoint: string;
  messages_endpoint: string;
  send_endpoint: string;
  platforms: ChatServicePlatform[];
  created_at: string;
  last_update: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatSettingsService {
  private apiUrl = environment.apiUrl;
  private configSubject = new BehaviorSubject<ChatServiceConfig | null>(null);

  config$ = this.configSubject.asObservable();

  isConfigured$: Observable<boolean> = this.config$.pipe(
    map(config => {
      if (!config) return false;
      return config.enabled
        && !!config.base_url
        && config.has_auth_token
        && config.platforms.some(p => p.enabled);
    })
  );

  constructor(private http: HttpClient) {}

  loadConfig(): void {
    this.http.get<{ data: ChatServiceConfig }>(`${this.apiUrl}/admin/chat-service/settings`).pipe(
      map(response => response.data)
    ).subscribe({
      next: config => this.configSubject.next(config),
      error: () => {
        // Config not available — leave as null
      }
    });
  }

  saveConfig(update: Record<string, unknown>): Observable<ChatServiceConfig> {
    return this.http.put<{ data: ChatServiceConfig }>(`${this.apiUrl}/admin/chat-service/settings`, {
      data: update
    }).pipe(
      map(response => response.data),
      tap(config => this.configSubject.next(config))
    );
  }

  getConfig(): ChatServiceConfig | null {
    return this.configSubject.value;
  }

  getBaseUrl(): string {
    const config = this.configSubject.value;
    return config?.base_url || '';
  }

  getAuthToken(): string {
    const config = this.configSubject.value;
    return config?.auth_token || '';
  }

  getWsEndpoint(): string {
    const config = this.configSubject.value;
    return config?.ws_endpoint || '/crm/ws';
  }

  getChatsEndpoint(): string {
    const config = this.configSubject.value;
    return config?.chats_endpoint || '/crm/chats';
  }

  getResolvedEndpoint(endpoint: string, params: Record<string, string>): string {
    let resolved = endpoint;
    for (const [key, value] of Object.entries(params)) {
      resolved = resolved.replace(`{${key}}`, encodeURIComponent(value));
    }
    const baseUrl = this.getBaseUrl();
    return baseUrl ? `${baseUrl}${resolved}` : resolved;
  }

  getPlatformIcon(platformId: string): string {
    const config = this.configSubject.value;
    if (config) {
      const platform = config.platforms.find(p => p.id === platformId);
      if (platform?.icon) return platform.icon;
    }
    return 'chat';
  }
}
