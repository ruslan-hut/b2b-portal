import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { User } from '../core/models/user.model';

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

  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Load collapsed state from localStorage
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
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
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
        // Still navigate to login even if logout fails
        this.router.navigate(['/auth/login']);
      }
    });
  }
}

