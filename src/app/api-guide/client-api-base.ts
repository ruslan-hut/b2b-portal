import { environment } from '../../environments/environment';

/**
 * The Client API base URL, derived from the configured backend the same way the
 * reference page derives the spec URL: one deployment, one host, and no second
 * place to update when the portal moves.
 */
export function clientApiBase(): string {
  const origin = environment.apiUrl.replace(/\/api\/v1\/?$/, '');
  const absolute = /^https?:\/\//.test(origin) ? origin : window.location.origin + origin;
  return absolute.replace(/\/$/, '') + '/api/client/v1';
}
