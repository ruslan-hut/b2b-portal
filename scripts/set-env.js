#!/usr/bin/env node

/**
 * Applies per-installation configuration to the source tree before a build.
 * Run by `npm run set-env`, and by `npm run build:prod` before `ng build`.
 *
 * Environment variables:
 * - API_URL: Backend API URL (default: /api/v1)
 *   - Use relative path '/api/v1' for Docker deployment (same origin)
 *   - Use absolute URL 'https://api.domain.com/api/v1' for Nginx deployment (different origin)
 * - APP_TITLE: Application title (default: B2B Portal)
 * - THEME: brand name, matching src/brand/_<name>.scss (default: stock)
 * - THEME_COLOR: mobile browser chrome colour, hex (default: #667eea)
 *
 * Deployment Scenarios:
 * 1. Docker Monolith: API_URL=/api/v1 (backend serves frontend from ./static)
 * 2. Server + Nginx: API_URL=/api/v1 or absolute URL (Nginx proxies or different domain)
 *
 * Web fonts are not an environment variable: they belong to the brand, so they
 * live in scripts/brand-fonts.js keyed by THEME. This script only copies the
 * selected entry's <link> into index.html.
 *
 * This script writes into the source tree — environment.prod.ts, index.html,
 * src/brand/_active.scss and src/assets/branding/. That is deliberate and
 * predates the theming work, but it means `git status` is dirty after a
 * production build. Everything it writes is committed with its stock value, so
 * `git checkout` restores you.
 *
 * Theming contract: docs/development/theming-contract.md
 */

const fs = require('fs');
const path = require('path');
const { fontsFor, hasOwnFonts } = require('./brand-fonts');

const ROOT = path.join(__dirname, '..');
const BRAND_DIR = path.join(ROOT, 'src', 'brand');
const BRANDING_ASSETS = path.join(ROOT, 'branding');

// Get environment variables or use defaults
const apiUrl = process.env.API_URL || '/api/v1';  // Default to relative path for Docker
const appTitle = process.env.APP_TITLE || 'B2B Portal';
const theme = process.env.THEME || 'stock';
const themeColor = process.env.THEME_COLOR || '#667eea';

const fail = (message) => {
  console.error(`\nset-env: ${message}\n`);
  process.exit(1);
};

// ---------------------------------------------------------------- validation

/**
 * A mistyped THEME must stop the build, not quietly ship the stock brand. A
 * deploy that silently ignores its own branding secret is the failure mode this
 * whole mechanism exists to avoid.
 */
const availableThemes = fs
  .readdirSync(BRAND_DIR)
  .filter((f) => f.startsWith('_') && f.endsWith('.scss') && f !== '_active.scss')
  .map((f) => f.slice(1, -5))
  .sort();

if (!availableThemes.includes(theme)) {
  fail(
    `THEME="${theme}" has no brand file.\n` +
    `  expected: src/brand/_${theme}.scss\n` +
    `  available: ${availableThemes.join(', ')}\n` +
    `  see docs/development/theming-contract.md`
  );
}

if (!/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(themeColor)) {
  fail(`THEME_COLOR="${themeColor}" is not a hex colour (expected #rgb or #rrggbb).`);
}

console.log('========================================');
console.log('Setting Frontend Environment Variables');
console.log('========================================');
console.log(`API_URL: ${apiUrl}`);
console.log(`APP_TITLE: ${appTitle}`);
console.log(`THEME: ${theme}`);
console.log(`THEME_COLOR: ${themeColor}`);

// Detect deployment scenario based on API_URL
const isRelativePath = apiUrl.startsWith('/');
const deploymentScenario = isRelativePath ? 'Same-origin (Docker or Nginx proxy)' : 'Cross-origin (Nginx different domain)';
console.log(`Deployment: ${deploymentScenario}`);
console.log('========================================');

// -------------------------------------------------------------- environment

const envFilePath = path.join(ROOT, 'src', 'environments', 'environment.prod.ts');
let envContent = fs.readFileSync(envFilePath, 'utf8');

envContent = envContent.replace(
  /apiUrl:\s*['"].*?['"]/,
  `apiUrl: '${apiUrl}'`
);

fs.writeFileSync(envFilePath, envContent, 'utf8');

// ----------------------------------------------------------------- index.html

const indexPath = path.join(ROOT, 'src', 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

indexContent = indexContent.replace(
  /<title>.*?<\/title>/,
  `<title>${appTitle}</title>`
);

indexContent = indexContent.replace(
  /<meta name="apple-mobile-web-app-title" content=".*?">/,
  `<meta name="apple-mobile-web-app-title" content="${appTitle}">`
);

// The value the browser paints its chrome with before any script runs.
// ThemeService overwrites it from --header-bg once Angular boots; this is what
// shows during the load, so it should be the brand's, not indigo.
indexContent = indexContent.replace(
  /<meta name="theme-color" content=".*?">/,
  `<meta name="theme-color" content="${themeColor}">`
);

/**
 * The brand's web fonts. A brand file can name a face in --font-heading, but
 * only this makes the browser fetch it; without it the token resolves to the
 * system fallback and the theme looks correct in review and wrong on screen.
 *
 * Marker-delimited rather than pattern-matched: the region holds one <link>
 * today and may hold several (or an @font-face preload) tomorrow, and a regex
 * over "the font link" would silently rewrite the wrong one the day it does.
 */
const fonts = fontsFor(theme);
const FONT_MARKERS = /(<!-- fonts:start -->)[\s\S]*?(<!-- fonts:end -->)/;

if (!FONT_MARKERS.test(indexContent)) {
  fail(
    `could not find the <!-- fonts:start --> / <!-- fonts:end --> markers in ${indexPath}.\n` +
    `  they delimit the generated font <link>; see scripts/brand-fonts.js`
  );
}

indexContent = indexContent.replace(
  FONT_MARKERS,
  `$1\n  <link href="${fonts.href}" rel="stylesheet">\n  $2`
);

fs.writeFileSync(indexPath, indexContent, 'utf8');

console.log(
  `Fonts: ${fonts.families.join(' + ')}` +
  (hasOwnFonts(theme) ? '' : ` (no entry for "${theme}", inheriting stock)`)
);

// ---------------------------------------------------------------- the brand

/**
 * SCSS cannot read an environment variable, so the selection has to become a
 * file. _active.scss is a one-line forward that styles.scss @use-s; rewriting
 * it is the whole mechanism.
 */
const activePath = path.join(BRAND_DIR, '_active.scss');
const activeContent = fs.readFileSync(activePath, 'utf8');
const rewritten = activeContent.replace(/@forward\s+'[^']*';/, `@forward '${theme}';`);

if (rewritten === activeContent && !activeContent.includes(`@forward '${theme}';`)) {
  fail(`could not find the @forward line in ${activePath}. Has it been edited by hand?`);
}
fs.writeFileSync(activePath, rewritten, 'utf8');

/**
 * Brand-owned assets — the header logo today, whatever else a brand needs
 * later. Only src/assets/branding/ is replaced; the favicon and PWA icon sets
 * are NOT touched (see the contract's "known gaps"), because clobbering tracked
 * binaries in a developer's working tree during a build is a bad trade.
 */
const brandAssetSource = path.join(BRANDING_ASSETS, theme);
const brandAssetTarget = path.join(ROOT, 'src', 'assets', 'branding');

if (fs.existsSync(brandAssetSource)) {
  fs.rmSync(brandAssetTarget, { recursive: true, force: true });
  fs.cpSync(brandAssetSource, brandAssetTarget, { recursive: true });
  console.log(`Branding assets: branding/${theme}/ -> src/assets/branding/`);
} else {
  console.log(`Branding assets: none for "${theme}", keeping src/assets/branding/ as committed`);
}

console.log('Environment variables set successfully!');
console.log(`Updated: ${envFilePath}`);
console.log(`Updated: ${indexPath}`);
console.log(`Updated: ${activePath}`);
