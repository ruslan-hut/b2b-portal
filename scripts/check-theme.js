#!/usr/bin/env node

/**
 * Theme integrity checks. Run with `npm run check:theme`; wired into CI.
 *
 * DESIGN_POLICY.md §7 has said "don't hardcode hex colors" since the admin
 * migration, but nothing enforced it, and the drift it allowed is exactly what
 * blocks per-installation theming: a literal in a component is a colour that no
 * theme can reach. These checks make the rule real.
 *
 *   1. No colour literals in component stylesheets.
 *   2. No colour-literal fallbacks in var() — `var(--x, #fff)` silently paints
 *      #fff the day --x is renamed, and no theme can override it.
 *   3. Every var(--token) resolves to something defined. Seven token names were
 *      already dead when this check was written; their hex fallbacks were what
 *      actually rendered, including a Material blue on a primary button.
 *   4. The light and dark palettes define the same token names. They are two
 *      hand-maintained lists; without this they drift.
 *   5. Foreground/background pairs clear WCAG AA. DESIGN_POLICY.md promises
 *      4.5:1 on every badge pair; a themed installation can only keep that
 *      promise if something measures it.
 *   6. Installation brands override only tokens that exist, and never semantic
 *      or badge colour.
 *   7. Every font family a brand names is actually loaded. A token can name a
 *      face; only the <link> fetches one, and the gap between the two renders
 *      as a system fallback with a green build.
 *
 * See docs/development/theming-contract.md.
 */

const fs = require('fs');
const path = require('path');
const { BRAND_FONTS, fontsFor } = require('./brand-fonts');

const SRC = path.join(__dirname, '..', 'src');
const THEMES = path.join(SRC, 'styles', '_themes.scss');

let failures = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };

// ---------------------------------------------------------------- utilities

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.scss')) out.push(p);
  }
  return out;
}

/** Blank out comments so they never trip a check. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

const rel = (p) => path.relative(path.join(__dirname, '..'), p);

/** Declarations inside `@mixin <name> { ... }`. */
function paletteOf(text, mixin) {
  const start = text.indexOf(`@mixin ${mixin} {`);
  if (start < 0) throw new Error(`mixin ${mixin} not found in _themes.scss`);
  let depth = 0, i = text.indexOf('{', start);
  const open = i;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) break;
  }
  const body = stripComments(text.slice(open + 1, i));
  const tokens = new Map();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(m[1], m[2].trim());
  }
  return tokens;
}

/** Brand files under src/brand/, excluding the generated _active.scss. */
function brands() {
  const dir = path.join(SRC, 'brand');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('_') && f.endsWith('.scss') && f !== '_active.scss')
    .map((f) => ({ name: f.slice(1, -5), text: fs.readFileSync(path.join(dir, f), 'utf8') }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Tokens an installation brand may NOT set. Semantic colour and the badge sets
 * mean something — green is live, red is stopped — and a brand that recolours
 * them is not theming, it is changing what the UI says. Contract §3.
 */
const BRAND_FORBIDDEN = [
  '--color-success', '--color-danger', '--color-warning', '--color-info',
  '--color-error', '--color-on-error',
  '--gradient-danger', '--gradient-success',
  '--status-', '--phase-', '--priority-', '--stage-',
  '--color-platform-',
];

// -------------------------------------------------------- 1 & 2: literals

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(|\b(?:white|black|red|green|blue|grey|gray|silver|orange|yellow|purple|pink)\b/;
const componentFiles = walk(path.join(SRC, 'app'));

/**
 * Custom properties the templates set at runtime — `[style.--stage-color]` and
 * friends. They are never declared in a stylesheet, so check 3 has to learn
 * them from the templates rather than assume they are dead.
 */
function runtimeInjected() {
  const found = new Set();
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(p);
      else if (/\.(html|ts)$/.test(entry.name)) {
        const text = fs.readFileSync(p, 'utf8');
        for (const m of text.matchAll(/\[style\.(--[\w-]+)\]/g)) found.add(m[1]);
        for (const m of text.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) found.add(m[1]);
      }
    }
  };
  scan(path.join(SRC, 'app'));
  return found;
}

console.log('\n[1] colour literals in component stylesheets');
for (const file of componentFiles) {
  const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\([\d.]/);
    if (m) fail(`${rel(file)}:${i + 1}  ${line.trim()}\n      → use a token from src/styles/_themes.scss`);
  });
}
if (!failures) console.log('  ok — every colour comes from a token');

console.log('\n[2] colour-literal fallbacks in var()');
const before2 = failures;
for (const file of [...componentFiles, path.join(SRC, 'styles.scss'), THEMES]) {
  const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/var\(\s*--[\w-]+\s*,\s*([^;]*)/g)) {
      if (COLOUR.test(m[1])) {
        fail(`${rel(file)}:${i + 1}  ${line.trim()}\n      → drop the fallback; a token that may be missing is a bug, not a default`);
      }
    }
  });
}
if (failures === before2) console.log('  ok — no fallback colours hiding behind a token name');

// ----------------------------------------------------- 3: undefined tokens

console.log('\n[3] var() references resolve');
const before3 = failures;

const defined = new Set(runtimeInjected());
const allStyleFiles = [path.join(SRC, 'styles.scss'), ...walk(path.join(SRC, 'styles')), ...componentFiles];
for (const file of allStyleFiles) {
  for (const m of stripComments(fs.readFileSync(file, 'utf8')).matchAll(/(--[\w-]+)\s*:/g)) {
    defined.add(m[1]);
  }
}
for (const file of allStyleFiles) {
  const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/var\(\s*(--[\w-]+)/g)) {
      // SCSS interpolated names (#{$x}) are not resolvable statically.
      if (!defined.has(m[1]) && !m[1].includes('#{')) {
        fail(`${rel(file)}:${i + 1}  var(${m[1]}) is not defined anywhere`);
      }
    }
  });
}
if (failures === before3) console.log(`  ok — all references resolve (${defined.size} properties defined, incl. ${runtimeInjected().size} set at runtime)`);

// --------------------------------------------------------- 4: palette parity

console.log('\n[4] light/dark palette parity');
const before4 = failures;
const themesText = fs.readFileSync(THEMES, 'utf8');
const light = paletteOf(themesText, 'light-palette');
const dark = paletteOf(themesText, 'dark-palette');

for (const name of light.keys()) {
  if (!dark.has(name)) fail(`${name} is defined in light-palette but not dark-palette`);
}
for (const name of dark.keys()) {
  if (!light.has(name)) fail(`${name} is defined in dark-palette but not light-palette`);
}
if (failures === before4) console.log(`  ok — both palettes define the same ${light.size} tokens`);

// ------------------------------------------------------- 5: contrast floors

/**
 * DESIGN_POLICY.md commits to 4.5:1 on badge and status pairs ("Every pair
 * clears 4.5:1, same rule as the status badges above"). That was true of one
 * hand-tuned palette. The moment an installation supplies its own brand hue
 * (docs/development/theming-contract.md) the commitment is only as good as a
 * check, so this is the check.
 *
 * Pairs are discovered, not listed: any `--x-bg` with an `--x-text` or
 * `--x-color` partner is a foreground on a background by construction. A
 * handful of pairs that do not follow that naming are named explicitly.
 */
console.log('\n[5] contrast floors (WCAG AA, 4.5:1)');
const before5 = failures;

const AA = 4.5;
/**
 * Pairs that were already below AA when the check was written. Frozen at their
 * measured ratio so the check is a ratchet, not a rewrite: it will not let any
 * of these get worse, and it fails outright on any pair not on this list.
 *
 * These are real accessibility debt, not check artefacts. Two groups:
 *
 *   - Brand pairs. White on #667eea is 3.66:1. It clears AA-large (3:1), which
 *     is the applicable floor for the 14px semibold button labels it is used
 *     for, but not AA-normal. A themed installation supplying a lighter primary
 *     makes this worse, which is what the ratchet is here to catch.
 *   - CRM badge sets (--priority-*, --status-{pending,in-progress,completed,
 *     cancelled}-*, --stage-*). These predate the badge-contrast pass that
 *     tuned --status-{draft,new,processing,confirmed,cancelled}-* and
 *     --phase-*; those two sets do clear 4.5:1 and are not listed here.
 *
 * Removing an entry after the design team retunes the colour is the goal.
 */
const BASELINE = {
  'light:--color-on-primary on --color-primary': 3.66,
  'light:--color-alert-error-text on --color-alert-error-bg': 4.41,
  'light:--priority-low-color on --priority-low-bg': 4.27,
  'light:--priority-medium-color on --priority-medium-bg': 3.29,
  'light:--priority-high-color on --priority-high-bg': 1.99,
  'light:--priority-urgent-color on --priority-urgent-bg': 3.29,
  'light:--status-pending-color on --status-pending-bg': 4.27,
  'light:--status-in-progress-color on --status-in-progress-bg': 3.29,
  'light:--status-completed-color on --status-completed-bg': 2.09,
  'light:--status-cancelled-color on --status-cancelled-bg': 2.90,
  'light:--stage-new-color on --stage-new-bg': 4.24,
  'light:--stage-qualified-color on --stage-qualified-bg': 3.32,
  'light:--stage-negotiation-color on --stage-negotiation-bg': 2.86,
  'light:--stage-won-color on --stage-won-bg': 3.32,
  'light:--stage-lost-color on --stage-lost-bg': 3.95,
  'dark:--color-on-secondary on --color-secondary': 4.37,
};
const EXPLICIT = [
  ['--color-primary', '--color-on-primary'],
  ['--color-secondary', '--color-on-secondary'],
  ['--color-error', '--color-on-error'],
  ['--color-primary-container', '--color-on-primary-container'],
  ['--color-secondary-container', '--color-on-secondary-container'],
  ['--color-error-container', '--color-on-error-container'],
  ['--color-success-container', '--color-on-success-container'],
  ['--card-bg', '--color-text-primary'],
  ['--card-bg', '--color-text-secondary'],
  ['--color-background', '--color-text-primary'],
  ['--admin-nav-bg', '--admin-nav-text'],
  ['--adm-bar-bg', '--color-text-primary'],
  ['--color-alert-warning-bg', '--color-alert-warning-text'],
  ['--color-alert-error-bg', '--color-alert-error-text'],
];

/** Follow var() chains inside one palette down to a literal colour. */
function resolve(palette, name, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  const value = palette.get(name);
  if (!value) return null;
  const chained = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (chained) return resolve(palette, chained[1], seen);
  return parseColour(value);
}

/** -> [r, g, b, a]; null for gradients, color-mix and keywords. */
function parseColour(value) {
  let m = value.match(/^#([0-9a-fA-F]{3})$/);
  if (m) return [...[...m[1]].map((c) => parseInt(c + c, 16)), 1];
  m = value.match(/^#([0-9a-fA-F]{6})$/);
  if (m) return [...[0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)), 1];
  m = value.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  return null;
}

/**
 * Most badge tints are translucent — `rgba(239, 68, 68, 0.1)` and friends — so
 * comparing their raw channels is meaningless (a tint and its own text colour
 * come out at 1.00:1). Composite onto the surface a badge actually sits on
 * before measuring.
 */
function flatten(colour, ground) {
  const [r, g, b, a] = colour;
  if (a >= 1) return [r, g, b];
  const [br, bg_, bb] = ground;
  return [r, g, b].map((c, i) => Math.round(c * a + [br, bg_, bb][i] * (1 - a)));
}

const luminance = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function pairsFor(palette) {
  const seen = new Set();
  const pairs = [];
  const add = (bg, fg) => {
    const key = `${bg}|${fg}`;
    if (seen.has(key) || !palette.has(bg) || !palette.has(fg)) return;
    seen.add(key);
    pairs.push([bg, fg]);
  };
  for (const [bg, fg] of EXPLICIT) add(bg, fg);
  for (const name of palette.keys()) {
    if (!name.endsWith('-bg')) continue;
    const stem = name.slice(0, -3);
    for (const suffix of ['-text', '-color']) add(name, stem + suffix);
  }
  return pairs;
}

/**
 * Measure one palette. `overrides` is a brand's token map; pairs it touches
 * must clear AA outright — the BASELINE grandfathers pre-existing stock debt,
 * not new decisions made by a brand.
 */
function measure(label, palette, overrides = new Map()) {
  const effective = new Map([...palette, ...overrides]);
  const cardRaw = resolve(effective, '--card-bg');
  // Badges sit on cards, so that is the ground a translucent tint composites onto.
  const ground = cardRaw ? flatten(cardRaw, [255, 255, 255]) : [255, 255, 255];
  let checked = 0, skipped = 0, grandfathered = 0;

  for (const [bgName, fgName] of pairsFor(effective)) {
    const bgRaw = resolve(effective, bgName);
    const fgRaw = resolve(effective, fgName);
    if (!bgRaw || !fgRaw) { skipped++; continue; }
    checked++;

    const bg = flatten(bgRaw, ground);
    const r = ratio(bg, flatten(fgRaw, bg));
    const touched = overrides.has(bgName) || overrides.has(fgName);
    const floor = touched ? undefined : BASELINE[`${label}:${fgName} on ${bgName}`];
    const where = overrides.size ? `${label} (brand)` : label;

    if (floor !== undefined) {
      grandfathered++;
      if (r < floor - 0.01) {
        fail(`${where}: ${fgName} on ${bgName} dropped to ${r.toFixed(2)}:1 ` +
             `(was ${floor.toFixed(2)}:1). Below AA already — do not make it worse.`);
      }
    } else if (r < AA) {
      fail(`${where}: ${fgName} on ${bgName} is ${r.toFixed(2)}:1, below ${AA}:1` +
           (touched ? ' — a brand that sets a pair must clear AA outright' : ''));
    }
  }
  return { checked, skipped, grandfathered };
}

let tally = { checked: 0, skipped: 0, grandfathered: 0 };
for (const [scheme, palette] of [['light', light], ['dark', dark]]) {
  const r = measure(scheme, palette);
  tally = {
    checked: tally.checked + r.checked,
    skipped: tally.skipped + r.skipped,
    grandfathered: tally.grandfathered + r.grandfathered,
  };
}
if (failures === before5) {
  console.log(`  ok — stock: ${tally.checked - tally.grandfathered} pairs clear ${AA}:1; ` +
              `${tally.grandfathered} known-below-AA held at baseline; ` +
              `${tally.skipped} not statically comparable`);
}

// ------------------------------------------------------ 6: installation brands

console.log('\n[6] installation brands');
const before6 = failures;

const allBrands = brands();

/**
 * A brand may set any palette token, plus the two font families. The fonts live
 * in the base `:root` block rather than a palette — they are per-installation
 * but not per-scheme — and contract §3 names them as the one exception to
 * "nothing in base :root is themable". Everything else there (spacing, radii,
 * control heights) stays out of reach on purpose: an installation that changes
 * the density is forking the design system, not theming it.
 */
const BRAND_SETTABLE_BASE = ['--font-heading', '--font-body'];
const stockNames = new Set([...light.keys(), ...dark.keys(), ...BRAND_SETTABLE_BASE]);

for (const brand of allBrands) {
  const overrides = {
    light: paletteOf(brand.text, 'light-overrides'),
    dark: paletteOf(brand.text, 'dark-overrides'),
  };

  for (const [scheme, tokens] of Object.entries(overrides)) {
    for (const name of tokens.keys()) {
      // A brand can only override something that exists. A typo here is a
      // silent no-op — the worst kind of theming bug, because the build is
      // green and the colour is simply the old one.
      if (!stockNames.has(name)) {
        fail(`brand "${brand.name}" (${scheme}) sets ${name}, which is not in the stock palette ` +
             `(base :root tokens a brand may set: ${BRAND_SETTABLE_BASE.join(', ')})`);
      }
      const forbidden = BRAND_FORBIDDEN.find((prefix) => name.startsWith(prefix));
      if (forbidden) {
        fail(`brand "${brand.name}" (${scheme}) sets ${name} — semantic and badge colour ` +
             `is fixed across installations (contract §3)`);
      }
    }
    // Contrast, with the brand applied.
    measure(scheme, scheme === 'light' ? light : dark, tokens);
  }

  const total = overrides.light.size + overrides.dark.size;
  if (failures === before6) {
    console.log(`  ok — "${brand.name}": ${total} override${total === 1 ? '' : 's'} ` +
                `(${overrides.light.size} light, ${overrides.dark.size} dark), all resolve and clear AA`);
  }
}

if (!allBrands.length) console.log('  (no brand files under src/brand/)');

// ------------------------------------------------------------ 7: font loading

/**
 * The failure this exists to stop: a brand sets --font-heading to its own face,
 * nothing adds it to the <link>, and the stack falls through to the next
 * family. Nothing errors, the build is green, and the only symptom is that the
 * portal is set in the wrong typeface — which is exactly why brands carried
 * their typography as a comment until scripts/brand-fonts.js existed.
 *
 * Only the FIRST family of a stack is checked. The rest are the fallback chain
 * and are meant not to be fetched.
 */
console.log('\n[7] brand fonts are loaded, not just named');
const before7 = failures;

const FONT_TOKENS = ['--font-heading', '--font-body'];
const firstFamily = (stack) => {
  const first = stack.split(',')[0].trim();
  return first.replace(/^['"]|['"]$/g, '');
};

/**
 * index.html must load the fonts of whatever theme the tree is currently set
 * to. Which theme that is depends on when this runs, and both times are real:
 *
 *   - a plain checkout — _active.scss forwards 'stock', and `ng serve` uses
 *     index.html as committed, because set-env never runs in dev;
 *   - after `npm run set-env` — CI and the Dockerfile run it first, so the tree
 *     is the brand's and index.html should already hold the brand's link.
 *
 * So the invariant is not "index.html matches stock" (it does not, after
 * set-env — an earlier version of this check failed every themed deploy on
 * exactly that). It is that the generated files agree with each other:
 * _active.scss names the theme, index.html loads that theme's fonts.
 */
const activeText = fs.readFileSync(path.join(SRC, 'brand', '_active.scss'), 'utf8');
const activeMatch = activeText.match(/@forward\s+'([^']*)';/);
const activeTheme = activeMatch ? activeMatch[1] : 'stock';

const indexText = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const markers = indexText.match(/<!-- fonts:start -->([\s\S]*?)<!-- fonts:end -->/);
if (!markers) {
  fail('src/index.html has no <!-- fonts:start --> / <!-- fonts:end --> markers — set-env.js cannot write the brand font link');
} else if (!markers[1].includes(fontsFor(activeTheme).href)) {
  fail(`src/index.html loads fonts that are not brand "${activeTheme}"'s, which is what ` +
       `src/brand/_active.scss forwards.\n` +
       `      → run \`npm run set-env\` (or \`git checkout src/index.html src/brand/_active.scss\` ` +
       `to get back to stock)`);
}

// Each registry entry must actually deliver the families it claims.
for (const [name, entry] of Object.entries(BRAND_FONTS)) {
  for (const family of entry.families) {
    if (entry.href && !entry.href.includes(family)) {
      fail(`brand-fonts.js: "${name}" claims ${family} but its href never requests it`);
    }
  }
}

for (const brand of allBrands) {
  const tokens = new Map([
    ...paletteOf(brand.text, 'light-overrides'),
    ...paletteOf(brand.text, 'dark-overrides'),
  ]);
  const loadable = fontsFor(brand.name).families;
  const named = [];

  for (const token of FONT_TOKENS) {
    if (!tokens.has(token)) continue;
    const family = firstFamily(tokens.get(token));
    named.push(family);
    if (!loadable.includes(family)) {
      fail(`brand "${brand.name}" sets ${token} to ${family}, which no stylesheet loads\n` +
           `      → add it to BRAND_FONTS.${brand.name} in scripts/brand-fonts.js, ` +
           `or it will silently render the next family in the stack`);
    }
  }

  // A brand may legitimately set only one of the two; setting neither is the
  // "inherit the stock pairing" case and needs no registry entry.
  if (named.length && failures === before7) {
    console.log(`  ok — "${brand.name}": ${[...new Set(named)].join(' + ')} named and loaded`);
  }
}
if (failures === before7) {
  console.log(`  ok — index.html loads brand "${activeTheme}"'s fonts; no brand names a face it cannot load`);
}

// ------------------------------------------------------------------ result

console.log('');
if (failures) {
  console.error(`FAILED — ${failures} problem${failures === 1 ? '' : 's'}. See docs/development/theming-contract.md.\n`);
  process.exit(1);
}
console.log('All theme checks passed.\n');
