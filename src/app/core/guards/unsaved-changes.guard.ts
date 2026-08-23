import { CanDeactivateFn } from '@angular/router';

/**
 * Implemented by any component that holds work the user has not committed yet.
 *
 * The component owns the question, not the guard: only it knows whether
 * anything changed and how to phrase the warning in its own vocabulary.
 */
export interface UnsavedChangesAware {
  /** Resolve false to keep the user where they are. */
  confirmLeave(): Promise<boolean> | boolean;
}

/**
 * Stops a navigation away from unsaved work.
 *
 * Route-level rather than component-level because the ways out of an editor
 * are mostly not its own buttons — a breadcrumb, the sidebar, the browser's
 * back button. Only the router sees all of them.
 *
 * Pairs with a `window:beforeunload` listener on the component for the ones the
 * router never sees: tab close and reload.
 */
export const unsavedChangesGuard: CanDeactivateFn<UnsavedChangesAware> = component =>
  typeof component?.confirmLeave === 'function' ? component.confirmLeave() : true;
