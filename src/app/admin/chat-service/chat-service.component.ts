import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatSettingsService, ChatServiceConfig, ChatServicePlatform } from '../chat/services/chat-settings.service';
import { formatDateTime } from '../../core/utils/date-format';

@Component({
  selector: 'app-chat-service',
  templateUrl: './chat-service.component.html',
  styleUrl: './chat-service.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatServiceComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  settings: ChatServiceConfig | null = null;
  loading = false;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Connection settings
  enabled = false;
  baseUrl = '';
  authToken = '';
  showAuthToken = false;
  showAuthTokenInput = false;

  // Endpoints
  wsEndpoint = '/crm/ws';
  chatsEndpoint = '/crm/chats';
  messagesEndpoint = '/crm/chats/{platform}/{userId}/messages';
  sendEndpoint = '/crm/chats/{platform}/{userId}/send';
  showEndpoints = false;

  // Platforms
  platforms: ChatServicePlatform[] = [];

  // New platform form
  showNewPlatform = false;
  newPlatform: ChatServicePlatform = { id: '', name: '', enabled: true, base_url: '', icon: 'chat' };

  constructor(
    private chatSettingsService: ChatSettingsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get enabledPlatformsCount(): number {
    return this.platforms.filter(p => p.enabled).length;
  }

  loadSettings(): void {
    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.chatSettingsService.config$.subscribe(config => {
        if (config) {
          this.settings = config;
          this.enabled = config.enabled;
          this.baseUrl = config.base_url;
          this.wsEndpoint = config.ws_endpoint || '/crm/ws';
          this.chatsEndpoint = config.chats_endpoint || '/crm/chats';
          this.messagesEndpoint = config.messages_endpoint || '/crm/chats/{platform}/{userId}/messages';
          this.sendEndpoint = config.send_endpoint || '/crm/chats/{platform}/{userId}/send';
          this.platforms = [...config.platforms];
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );

    this.chatSettingsService.loadConfig();
  }

  saveSettings(): void {
    this.saving = true;
    this.error = null;
    this.successMessage = null;

    const update: Record<string, unknown> = {
      base_url: this.baseUrl,
      enabled: this.enabled,
      ws_endpoint: this.wsEndpoint,
      chats_endpoint: this.chatsEndpoint,
      messages_endpoint: this.messagesEndpoint,
      send_endpoint: this.sendEndpoint,
      platforms: JSON.parse(JSON.stringify(this.platforms))
    };

    // Only include auth token if user entered a new one
    if (this.authToken.trim()) {
      update['auth_token'] = this.authToken;
    }

    this.subscriptions.add(
      this.chatSettingsService.saveConfig(update).subscribe({
        next: () => {
          this.authToken = '';
          this.showAuthTokenInput = false;
          this.successMessage = 'Settings saved successfully';
          this.saving = false;
          this.cdr.detectChanges();

          setTimeout(() => {
            this.successMessage = null;
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to save settings';
          this.saving = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  toggleAuthTokenInput(): void {
    this.showAuthTokenInput = !this.showAuthTokenInput;
    if (!this.showAuthTokenInput) {
      this.authToken = '';
    }
    this.cdr.detectChanges();
  }

  toggleEndpoints(): void {
    this.showEndpoints = !this.showEndpoints;
    this.cdr.detectChanges();
  }

  resetEndpoints(): void {
    this.wsEndpoint = '/crm/ws';
    this.chatsEndpoint = '/crm/chats';
    this.messagesEndpoint = '/crm/chats/{platform}/{userId}/messages';
    this.sendEndpoint = '/crm/chats/{platform}/{userId}/send';
    this.cdr.detectChanges();
  }

  // Platform management
  addPresetPlatform(type: 'telegram' | 'instagram' | 'whatsapp'): void {
    const presets: Record<string, ChatServicePlatform> = {
      telegram: { id: 'telegram', name: 'Telegram', enabled: true, base_url: '', icon: 'send' },
      instagram: { id: 'instagram', name: 'Instagram', enabled: true, base_url: '', icon: 'camera_alt' },
      whatsapp: { id: 'whatsapp', name: 'WhatsApp', enabled: true, base_url: '', icon: 'phone' }
    };

    if (this.platforms.some(p => p.id === type)) {
      this.error = `Platform "${type}" already exists`;
      this.cdr.detectChanges();
      setTimeout(() => { this.error = null; this.cdr.detectChanges(); }, 2000);
      return;
    }

    this.platforms.push({ ...presets[type] });
    this.cdr.detectChanges();
  }

  toggleNewPlatformForm(): void {
    this.showNewPlatform = !this.showNewPlatform;
    if (this.showNewPlatform) {
      this.newPlatform = { id: '', name: '', enabled: true, base_url: '', icon: 'chat' };
    }
    this.cdr.detectChanges();
  }

  addCustomPlatform(): void {
    if (!this.newPlatform.id.trim() || !this.newPlatform.name.trim()) {
      this.error = 'Platform ID and name are required';
      this.cdr.detectChanges();
      setTimeout(() => { this.error = null; this.cdr.detectChanges(); }, 2000);
      return;
    }

    if (this.platforms.some(p => p.id === this.newPlatform.id)) {
      this.error = `Platform "${this.newPlatform.id}" already exists`;
      this.cdr.detectChanges();
      setTimeout(() => { this.error = null; this.cdr.detectChanges(); }, 2000);
      return;
    }

    this.platforms.push({ ...this.newPlatform });
    this.showNewPlatform = false;
    this.cdr.detectChanges();
  }

  removePlatform(index: number): void {
    this.platforms.splice(index, 1);
    this.cdr.detectChanges();
  }

  togglePlatformEnabled(index: number): void {
    this.platforms[index].enabled = !this.platforms[index].enabled;
    this.cdr.detectChanges();
  }

  refresh(): void {
    this.chatSettingsService.loadConfig();
  }

  formatDate(dateString: string): string {
    return formatDateTime(dateString);
  }
}
