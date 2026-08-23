#!/usr/bin/env node

/**
 * Which web fonts each installation loads.
 *
 * A brand file can set `--font-heading` / `--font-body` (contract §3 names them
 * as the one part of base `:root` a brand may touch), but a token names a face —
 * it does not fetch one. Until this file existed the <link> in index.html was
 * fixed at the stock pairing, so a brand that named its own font rendered the
 * system fallback: correct in code review, wrong on screen.
 *
 * So the two halves live here together, per theme:
 *
 *   families — the family names the brand's tokens are allowed to name. Only
 *              the FIRST family of a stack is checked; the rest of a stack is
 *              the system fallback and is never fetched.
 *   href     — the stylesheet that actually delivers them, written verbatim
 *              into index.html by scripts/set-env.js.
 *
 * `npm run check:theme` fails the build if a brand names a family its theme
 * does not load, or if `href` does not mention a family it claims. Adding a
 * font is therefore a two-line edit here, not a hunt through index.html.
 *
 * A theme with no entry keeps the stock link — which is the right default: a
 * brand that says nothing about type inherits the portal's.
 *
 * Self-hosted faces (a commercial licence, an @font-face block in src/assets)
 * are not modelled here. Such a theme wants `href: null` and its @font-face in
 * the brand's own stylesheet; nothing needs this file to change for that.
 *
 * Theming contract: docs/development/theming-contract.md
 */

const BRAND_FONTS = {
  /**
   * Montserrat headings + Commissioner body, with Ukrainian Cyrillic. The
   * pairing the design system was drawn against; every theme inherits it
   * unless it says otherwise.
   */
  stock: {
    families: ['Montserrat', 'Commissioner'],
    href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300..900&family=Commissioner:wght@100..900&display=swap&subset=latin,cyrillic',
  },
};

/** The fonts a theme loads, falling back to stock for a theme that sets none. */
const fontsFor = (theme) => BRAND_FONTS[theme] || BRAND_FONTS.stock;

/** True when `theme` has its own entry rather than inheriting stock's. */
const hasOwnFonts = (theme) => Object.prototype.hasOwnProperty.call(BRAND_FONTS, theme);

module.exports = { BRAND_FONTS, fontsFor, hasOwnFonts };
