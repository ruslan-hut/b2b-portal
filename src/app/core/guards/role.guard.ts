import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.model';

/**
 * Configurable role-based guard factory.
 * Creates a guard that checks if the authenticated user has one of the allowed roles.
 *
 * @param allowedRoles - Array of role names that are permitted to access the route
 * @param options - Optional configuration
 * @param options.requireUser - If true (default), only User entities are allowed (not Clients)
 * @param options.redirectTo - Custom redirect path for unauthorized access (default: '/products/catalog')
 *
 * @example
 * // Allow admin and manager roles
 * { path: 'dashboard', canActivate: [roleGuard(['admin', 'manager'])] }
 *
 * // Allow only admin role
 * { path: 'users', canActivate: [roleGuard(['admin'])] }
 *
 * // Allow any authenticated user (no role check)
 * { path: 'profile', canActivate: [roleGuard([])] }
 */
export const roleGuard = (
  allowedRoles: string[],
  options: { requireUser?: boolean; redirectTo?: string } = {}
): CanActivateFn => {
  const { requireUser = true, redirectTo = '/products/catalog' } = options;

  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Check if user is authenticated
    if (!authService.isAuthenticated()) {
      authService.clearAuth();
      router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const entity = authService.currentEntityValue;
    const entityType = authService.entityTypeValue;

    // Check if entity type is user (not a client)
    if (requireUser && entityType !== 'user') {
      router.navigate([redirectTo]);
      return false;
    }

    // If no roles specified, allow any authenticated user/entity
    if (allowedRoles.length === 0) {
      return true;
    }

    // Check if user has one of the allowed roles
    const user = entity as User;
    if (user && allowedRoles.includes(user.role)) {
      return true;
    }

    // User doesn't have required role
    router.navigate([redirectTo]);
    return false;
  };
};
