/**
 * Validates a `returnUrl` query parameter before it is handed to the router.
 *
 * A returnUrl lets a detail page send the user back to the exact list state
 * they came from — the invoicing analysis keeps its criteria in the query
 * string, so a bare route would drop them. Because the value arrives from the
 * URL it is attacker-controllable, and only same-origin, in-app paths are
 * accepted: anything absolute ("https://…"), scheme-relative ("//evil.tld") or
 * not rooted at "/" is rejected rather than navigated to.
 *
 * Returns null when the value is missing or fails the check, which callers
 * treat as "no return URL was supplied" and fall back to their default route.
 */
export function sanitizeReturnUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const url = raw.trim();
  if (!url.startsWith('/') || url.startsWith('//')) {
    return null;
  }
  // A backslash is treated as a slash by some URL parsers, so "/\evil.tld"
  // could escape the origin; refuse it outright.
  if (url.includes('\\')) {
    return null;
  }
  return url;
}
