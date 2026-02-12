import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { TranslationService } from '../core/services/translation.service';
import { User } from '../core/models/user.model';
import { ChatWebsocketService } from './chat/services/chat-websocket.service';
import { ChatService } from './chat/services/chat.service';

@Component({
    selector: 'app-admin',
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent implements OnInit, OnDestroy {
  isAdmin = false;
  isMenuCollapsed = false;
  isMobileMenuOpen = false;
  totalUnread$: Observable<number>;

  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router,
    private wsService: ChatWebsocketService,
    private chatService: ChatService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {
    this.totalUnread$ = this.chatService.totalUnread$;
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
        } else {
          this.isAdmin = false;
        }
      })
    );

    // WebSocket lifecycle — connect once for entire admin zone
    this.wsService.connect();
    this.chatService.loadChats();

    this.subscriptions.add(
      this.wsService.messages$.subscribe(event => {
        if (event.type === 'new_message') {
          const msg = event.data;
          this.chatService.handleNewMessage(msg);

          if (document.hidden && msg.direction === 'incoming') {
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

  private showNotification(msg: { sender: string; platform: string; text: string }): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const title = this.translationService.instant('chat.newMessage', {
      name: msg.sender,
      platform: msg.platform
    });
    new Notification(title, { body: msg.text });
  }
}
