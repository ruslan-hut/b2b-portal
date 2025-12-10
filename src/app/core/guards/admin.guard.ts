import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.model';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if user is authenticated
  if (!authService.isAuthenticated()) {
    authService.clearAuth();
    router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Check if entity is a user (not a client)
  const entity = authService.currentEntityValue;
  const entityType = authService.entityTypeValue;

  if (entityType !== 'user') {
    // Not a user, redirect to products
    router.navigate(['/products/catalog']);
    return false;
  }

  // Check if user has admin or manager role
  const user = entity as User;
  if (user && (user.role === 'admin' || user.role === 'manager')) {
    return true;
  }

  // User doesn't have required role, redirect to products
  router.navigate(['/products/catalog']);
  return false;
};

// Guard for admin-only routes (admin role required)
export const adminOnlyGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if user is authenticated
  if (!authService.isAuthenticated()) {
    authService.clearAuth();
    router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Check if entity is a user (not a client)
  const entity = authService.currentEntityValue;
  const entityType = authService.entityTypeValue;

  if (entityType !== 'user') {
    // Not a user, redirect to products
    router.navigate(['/products/catalog']);
    return false;
  }

  // Check if user has admin role
  const user = entity as User;
  if (user && user.role === 'admin') {
    return true;
  }

  // User doesn't have admin role, redirect to products
  router.navigate(['/products/catalog']);
  return false;
};

