import { CanActivateFn } from '@angular/router';
import { roleGuard } from './role.guard';

/**
 * Guard for admin zone routes.
 * Allows users with 'admin' or 'manager' role.
 */
export const adminGuard: CanActivateFn = (route, state) => {
  return roleGuard(['admin', 'manager'])(route, state);
};

/**
 * Guard for admin-only routes.
 * Allows only users with 'admin' role.
 */
export const adminOnlyGuard: CanActivateFn = (route, state) => {
  return roleGuard(['admin'])(route, state);
};
