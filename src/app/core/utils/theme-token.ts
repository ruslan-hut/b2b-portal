/**
 * Reads a CSS custom property off the document root.
 *
 * Almost nothing needs this: styling goes through `var(--token)` in SCSS, and
 * a `var()` reference works fine even when it is bound into a style attribute
 * from TypeScript. Use it only where a third-party API insists on a resolved
 * colour string it will not hand to the CSS engine — ReDoc's theme object, a
 * `<meta name="theme-color">` value, a canvas fill.
 *
 * Reaching for this to "get the theme colour" in ordinary component code is a
 * smell: the value is read once and will not follow a theme change.
 */
export function readToken(name: string, fallback = ''): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
