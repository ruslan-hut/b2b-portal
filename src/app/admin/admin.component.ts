import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { TranslationService } from '../core/services/translation.service';
import { User } from '../core/models/user.model';
import { ChatWebsocketService } from './chat/services/chat-websocket.service';
import { ChatService } from './chat/services/chat.service';
import { ChatSettingsService } from './chat/services/chat-settings.service';
import { CompanyService } from '../core/services/company.service';

@Component({
    selector: 'app-admin',
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent implements OnInit, OnDestroy {
  isAdmin = false;
  /** Content editors reach only the Partner Resources zone and their own profile. */
  isContentEditor = false;
  /** True for admins and managers — everything except the content-editor role. */
  isOperationalStaff = false;
  isMenuCollapsed = false;
  isMobileMenuOpen = false;
  totalUnread$: Observable<number>;
  isChatConfigured$: Observable<boolean>;
  hasCompanies$: Observable<boolean>;

  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router,
    private wsService: ChatWebsocketService,
    private chatService: ChatService,
    private chatSettingsService: ChatSettingsService,
    private companyService: CompanyService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {
    this.totalUnread$ = this.chatService.totalUnread$;
    this.isChatConfigured$ = this.chatSettingsService.isConfigured$;
    this.hasCompanies$ = this.companyService.hasCompanies$;
  }

  ngOnInit(): void {
    const savedState = localStorage.getItem('admin_menu_collapsed');
    if (savedState !== null) {
      this.isMenuCollapsed = savedState === 'true';
    }

    this.subscriptions.add(
      this.authService.currentEntity$.subscribe(entity => {
        if (entity && this.authService.entityTypeValue === 'user') {
          const user = entity as User;
          this.isAdmin = user?.role === 'admin';
          this.isContentEditor = user?.role === 'content_editor';
        } else {
          this.isAdmin = false;
          this.isContentEditor = false;
        }
        // Operational nav (orders, CRM, clients, ...) is for admins and
        // managers; content editors get the content zone and profile only.
        this.isOperationalStaff = !this.isContentEditor;
        if (this.isOperationalStaff) {
          this.companyService.loadHasCompanies();
        }
        this.cdr.markForCheck();
      })
    );

    // Load chat service config, then conditionally connect WS
    this.chatSettingsService.loadConfig();

    this.subscriptions.add(
      this.chatSettingsService.isConfigured$.subscribe(configured => {
        if (configured) {
          this.wsService.connect();
          this.chatService.loadChats();
        } else {
          this.wsService.disconnect();
        }
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.wsService.messages$.subscribe(event => {
        if (event.type === 'new_message') {
          const msg = event.data;
          this.chatService.handleNewMessage(msg);

          if (msg.direction === 'incoming' && !this.router.url.includes('/admin/chat')) {
            this.showNotification(msg);
          }
        }
      })
    );

    this.requestNotificationPermission();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.wsService.disconnect();
  }

  toggleMenu(): void {
    this.isMenuCollapsed = !this.isMenuCollapsed;
    localStorage.setItem('admin_menu_collapsed', this.isMenuCollapsed.toString());
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  /**
   * Leaves the admin zone for the client side.
   *
   * Content editors get the Partner Resources rather than the catalog: they have no
   * CatalogPreview capability, so the catalog would greet them with an empty
   * page and an error.
   */
  /**
   * Leave the admin chrome for the client-facing area.
   *
   * Every staff role lands on the catalog, content editors included: it is the
   * client's front door, and the header there links on to Partner Resources.
   * Editors used to be sent straight to /partners because the catalog rejected
   * them; now that they get the read-only preview, the detour would hide half
   * of what they came to look at.
   */
  goToClientZone(): void {
    this.router.navigate(['/products/catalog']);
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        this.router.navigate(['/auth/login']);
      }
    });
  }

  private requestNotificationPermission(): void {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  private showNotification(msg: { user_name?: string; platform: string; text: string }): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const title = this.translationService.instant('chat.newMessage', {
      name: msg.user_name || "user",
      platform: msg.platform
    });
    new Notification(title, { body: msg.text });
  }
}
