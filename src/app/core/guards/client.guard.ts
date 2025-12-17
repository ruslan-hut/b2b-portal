import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard that only allows client accounts to access the route
 * User accounts will be redirected to products catalog
 */
export const clientGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    // Not authenticated - redirect to login
    authService.clearAuth();
    router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Check if user is a client
  const entityType = authService.entityTypeValue;
  if (entityType === 'client') {
    return true;
  }

  // User accounts should not access client-only routes
  // Redirect to products catalog
  console.warn('This route is only available for client accounts');
  router.navigate(['/products/catalog']);
  return false;
};
