import { CanActivateFn } from '@angular/router';
import { roleGuard } from './role.guard';

/**
 * Guard for the admin shell route (the AdminComponent wrapper).
 * Allows every staff role that has *some* business inside /admin.
 *
 * IMPORTANT: this guard is intentionally permissive — it only decides who may
 * render the admin chrome. Every child route must carry its own guard. A child
 * that relies on this one for protection is reachable by all staff roles,
 * including content editors, who have no business in orders or CRM.
 */
export const adminZoneGuard: CanActivateFn = (route, state) => {
  return roleGuard(['admin', 'manager', 'content_editor'])(route, state);
};

/**
 * Guard for operational admin routes (orders, clients, CRM, products, ...).
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

/**
 * Guard for the Partner Resources content zone.
 * Allows users with 'admin' or 'content_editor' role. Managers are excluded —
 * they read the hub through the client-facing /partners route instead.
 */
export const contentEditorGuard: CanActivateFn = (route, state) => {
  return roleGuard(['admin', 'content_editor'])(route, state);
};
