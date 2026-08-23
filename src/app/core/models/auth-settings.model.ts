// Public auth settings exposed to unauthenticated clients (e.g. login page).
// Currently used to decide whether to surface the "forgot password" link.
export interface AuthSettings {
  mail_enabled: boolean;
  // Configurable portal name shown in the browser tab, header and login page.
  site_name?: string;
}
