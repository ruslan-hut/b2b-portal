# Theming contract

What an installation of this portal is allowed to change about how it looks, and
what it is not. Written for two readers: a designer producing a palette for a new
deployment, and a developer adding UI that has to survive one.

Enforced by `frontend/scripts/check-theme.js` (`npm run check:theme`, run in CI by
`.github/workflows/frontend-checks.yml`). If a rule here is not checked by that
script, treat it as advice; if it is checked, it is not negotiable.

Status: built. The token layer derives from a seed, and an installation selects
its brand with the `THEME` build argument. `stock` is the palette the portal
ships with; `example` is a working teal-and-copper brand kept in the repo so the
mechanism stays exercised.

---

## 1. How the token layer is shaped

Three files, three jobs:

| File | Holds | Themable? |
|---|---|---|
| `src/styles.scss` — base `:root` | spacing, type scale, radii, control heights, motion, z-index, fonts | No. Shared by every scheme and every installation. |
| `src/styles/_themes.scss` — `@mixin light-palette` | the light colour palette, 211 tokens | Yes, through the seed |
| `src/styles/_themes.scss` — `@mixin dark-palette` | the dark colour palette, same 211 tokens | Yes, through the seed |
| `src/brand/_<name>.scss` | one installation's overrides, `light-overrides` + `dark-overrides` | This **is** the theme |
| `src/brand/_active.scss` | generated one-line `@forward`, rewritten by `set-env.js` | Never edit by hand |
| `scripts/brand-fonts.js` | which web fonts each theme loads, and the `<link>` that delivers them | Yes — one entry per theme |

`styles.scss` includes them at three sites, each followed by the installation
brand so the brand wins on source order alone — it never needs higher
specificity, and it overrides tokens rather than restating a palette:

```scss
:root, [data-theme="light"] { @include light-palette; @include brand.light-overrides; }
[data-theme="dark"]         { @include dark-palette;  @include brand.dark-overrides;  }
@media (prefers-color-scheme: dark) {
  [data-theme="system"]     { @include dark-palette;  @include brand.dark-overrides;  }
}
```

The dark palette appears twice because `[data-theme="dark"]` and the media-gated
`[data-theme="system"]` cannot share a selector list. Before the mixin they were
two hand-synced copies of ~200 declarations, and they had already drifted. Never
inline a palette at an include site — add the token to the mixin.

**The user's light/dark switch is orthogonal to the installation theme.** The
installation picks the brand; the person picks the scheme. That means a themed
installation owes *two* palettes, or a deliberate decision that dark keeps the
stock neutrals and only the accent moves.

---

## 2. The seed

Each palette opens with a small block of literal brand colours. Everything
downstream derives from it and **must not restate a hue**:

```scss
@mixin light-palette {
  --color-primary: #667eea;
  --color-primary-dark: #5568d3;
  --color-primary-light: #8099ff;
  --color-secondary: #764ba2;
  --color-secondary-dark: #5f3d85;
  ...
```

Derived, never hand-written:

```scss
--gradient-primary: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
--focus-ring-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
--shadow-primary:   0 5px 20px color-mix(in srgb, var(--color-primary) 40%, transparent);
--color-primary-overlay: color-mix(in srgb, var(--color-primary) 12%, transparent);
```

Before this was true, the hue `#667eea` was transcribed in 22 places and
changing `--color-primary` alone left the focus ring, the table-header gradient
and the button glow indigo. If you add a token that is a tint, shade or glow of
the brand, derive it with `color-mix(in srgb, var(--color-primary) N%, transparent)`.

> `--color-primary-rgb` and the other `-rgb` channel triplets are **gone**. They
> were a second transcription of every hue. `rgba(var(--color-x-rgb), 0.1)`
> is now `color-mix(in srgb, var(--color-x) 10%, transparent)`, which is
> byte-equivalent in sRGB and needs no companion token.

---

## 3. What an installation may set

**Themable — this is the point of the feature.**

- The seed: `--color-primary{,-dark,-light}`, `--color-secondary{,-dark}`
- Neutral ground: `--color-background{,-secondary,-elevated,-card,-hover,-active}`,
  `--card-bg`, `--input-bg`, `--adm-bar-bg`, `--header-bg`
- Text and border: `--color-text-{primary,secondary,muted,light,inverse}`,
  `--color-border{,-light,-subtle}`
- Admin chrome: `--admin-nav-bg`, `--admin-nav-item-{hover,active}-bg`,
  `--admin-nav-text`, `--admin-header-bg`, `--admin-content-bg`.
  Note this is a **separate palette** from the brand today (`#2c3e50` / `#3498db`
  have no relationship to `--color-primary`). A theme has to decide it explicitly.
- `--table-header-bg`. Light derives it from `--gradient-primary`; dark deliberately
  does not (it mutes the brand to `linear-gradient(135deg, #2d3748, #352f44)`).
  A theme must make that call for itself.
- Optional and powerful: `--font-heading`, `--font-body`. These live in base
  `:root`, not the palettes — they are per-installation but not per-scheme, so a
  brand that sets them must set them in **both** `light-overrides` and
  `dark-overrides` (the light block lands in `:root`, the dark one in
  `[data-theme="dark"]`).

  A token names a face; it does not fetch one. Give the theme an entry in
  `scripts/brand-fonts.js` — `families` plus the stylesheet `href` — and
  `set-env.js` writes that `<link>` into the `<!-- fonts:start -->` region of
  `index.html`. Check 7 fails the build if a brand names a family its theme does
  not load, which is the whole point: without it the stack falls silently
  through to the next family and only the rendered page shows it. A theme with
  no entry inherits the stock pairing.

**Not themable.**

- **Semantic colour.** `--color-{success,danger,warning,info}` and everything
  built on them. Green means live, red means stopped. An installation that
  recolours these is not theming, it is changing what the UI says.
- **Status and phase badges.** `--status-*`, `--phase-*`, `--priority-*`,
  `--stage-*`. Each pair is tuned against a contrast floor (§5).
- **User-data colour.** CRM stage colours, tag colours — these come from the
  database per record and reach the DOM through `[style.--stage-color]` /
  `[style.--accent-color]` bindings. They are content, not theme.
- **Platform brand colour.** `--color-platform-{telegram,instagram,whatsapp}` are
  other companies' marks.
- **Anything in base `:root`** other than the two font families. An installation
  that changes the spacing scale or control heights is forking the design system,
  not theming it.

---

## 4. Rules for writing UI

These are checked. A violation fails CI.

1. **No colour literal in a component stylesheet.** No hex, no `rgb()/rgba()/hsl()`,
   no `white`/`black`. Every colour comes from a token in `_themes.scss`.
   *(check 1)*

2. **No colour fallback in `var()`.** `var(--x, #fff)` is not a safe default — it
   is a colour no theme can reach, waiting for `--x` to be renamed. If a token
   might be missing, that is a bug to fix, not a case to handle. *(check 2)*

3. **Every `var(--token)` must resolve.** A reference to a name nothing defines
   drops the whole declaration silently. The first run of this check found **62**
   such references, including a primary-button hover that had been painting
   Material blue `#1565c0` and a chat active-row hardcoding indigo. Properties
   injected at runtime via `[style.--x]` are discovered from the templates and
   do not count as undefined. *(check 3)*

4. **Add a token to both palettes at once.** *(check 4)*

5. **Colour a foreground and its background together.** If you add `--x-bg`, add
   `--x-text` (or `--x-color`) and check 5 will measure the pair automatically.

6. **A brand may only override a token that exists.** A typo'd name in a brand
   file is a silent no-op — the build is green and the colour is simply the old
   one, which is the worst kind of theming bug. *(check 6)*

7. **A brand may only override what §3 permits.** Setting a semantic or badge
   token from a brand file is rejected by name. *(check 6)*

8. **Name only a font you load.** A brand setting `--font-heading` to a family
   its `scripts/brand-fonts.js` entry does not deliver is rejected. The stack
   would otherwise fall through to the next family with a green build, and the
   only symptom would be the rendered page. *(check 7)*

For a value a third-party API needs as a resolved string — ReDoc's theme object,
`<meta name="theme-color">` — use `readToken()` from
`src/app/core/utils/theme-token.ts` rather than restating the colour. Note it
reads once and will not follow a theme change; that is fine for those two cases
and wrong for anything else.

---

## 5. Contrast

`DESIGN_POLICY.md` commits to 4.5:1 on badge pairs. That was true of one
hand-tuned palette; with per-installation colour it is only as true as a check.

Check 5 discovers every `--x-bg` / `--x-text` pair plus a list of explicit ones
(`--color-primary` / `--color-on-primary`, `--card-bg` / `--color-text-primary`,
`--admin-nav-bg` / `--admin-nav-text`, …), composites translucent tints onto
`--card-bg`, and requires 4.5:1. 82 pairs currently clear it.

**16 pairs do not, and are frozen at their measured ratio in a `BASELINE` map.**
The check is a ratchet: those may improve, never regress, and any pair *not* on
the list must clear 4.5:1 outright.

The baseline grandfathers *stock* debt, not decisions a brand makes. A brand
inherits a baselined pair only if it overrides neither of its two tokens; the
moment it sets either one, that pair must clear 4.5:1 outright. Setting a pale
primary is rejected with the measured number, not a warning. The debt is real and worth scheduling:

| Group | Ratio | Note |
|---|---|---|
| `--color-on-primary` on `--color-primary` (light) | 3.66:1 | White on `#667eea`. Clears AA-large (3:1), which is the applicable floor for the 14px semibold button labels it is used for — but a lighter installation primary breaks even that. |
| `--color-on-secondary` on `--color-secondary` (dark) | 4.37:1 | Marginal. |
| `--color-alert-error-text` on `--color-alert-error-bg` (light) | 4.41:1 | Marginal. |
| `--priority-*` (4 pairs, light) | 1.99–4.27:1 | CRM. `--priority-high` at 1.99:1 is the worst pair in the system. |
| `--status-{pending,in-progress,completed,cancelled}-*` (light) | 2.09–4.27:1 | CRM task status. Distinct from the order-status set. |
| `--stage-*` (5 pairs, light) | 2.86–3.95:1 | CRM pipeline stages. |

The order-status set (`--status-{draft,new,processing,confirmed,cancelled}-*`) and
the client phase set (`--phase-*`) **do** clear 4.5:1 — the policy's claim about
them holds. The failures are all in CRM sets that predate that pass.

**The constraint this puts on a theme:** an installation primary must clear
4.5:1 against `--color-on-primary`, or the theme must also supply an
`--color-on-primary` that does. A pastel or mid-yellow primary with white text
fails, and there are enough white-on-primary surfaces (table header, primary
button, active nav item) that it fails visibly. `--color-primary: #ffd84d` is
rejected at build time as `1.38:1, below 4.5:1`.

---

## 6. Adding a brand

### The mechanism

SCSS cannot read an environment variable, so the selection becomes a file:
`scripts/set-env.js` rewrites the single `@forward` line in
`src/brand/_active.scss`, which `styles.scss` `@use`s. `_active.scss` is
committed pointing at `stock`, so a plain `ng build` or `ng serve` works with no
setup.

```
THEME=example npm run set-env     # rewrites src/brand/_active.scss
npm run check:theme               # validates the brand (check 6)
npm run build:prod
```

`build:prod` runs `set-env` itself, so in CI the environment variable is enough.
A `THEME` with no matching file **aborts the build**; a deploy must not quietly
ship the stock palette because a secret was mistyped.

### Where it is plumbed

| Surface | Input |
|---|---|
| `Dockerfile` | `ARG THEME`, `ARG THEME_COLOR` → `ENV` → `npm run check:theme && npm run build:prod` |
| `docker-compose.yml` | `build.args` |
| `deploy-pl.yml` | `vars.THEME` / `secrets.THEME`, `vars.THEME_COLOR` |
| `deploy-ua.yml` | `vars.UA_THEME`, `vars.UA_THEME_COLOR` |
| `deploy-standalone.yml` | `secrets.THEME`, `secrets.THEME_COLOR` (docker build-args) |

All three deploy workflows run `npm run check:theme` after `set-env`, so a brand
that fails contrast stops the deploy rather than reaching users.

### Writing one

1. Copy `src/brand/_stock.scss` to `src/brand/_<installation>.scss`.
2. Fill in `light-overrides` and `dark-overrides`. Both mixins must exist even
   if empty. Override only what §3 permits — check 6 enforces this.
3. Run `npm run check:theme`. It will tell you if you typo'd a token name
   (a silent no-op otherwise), crossed the contract, or broke contrast.
4. Optionally add `branding/<installation>/logo.png`; `set-env.js` copies that
   directory over `src/assets/branding/`.
5. If the brand has its own typeface, add an entry to `scripts/brand-fonts.js`
   **and** set `--font-heading` / `--font-body` in both mixins. Either half
   alone is a bug; check 7 catches it.
6. Set `THEME` (and `THEME_COLOR` for the pre-boot browser chrome) in the
   deployment's repository variables.

Document it, in a `theming-brand-<name>.md` beside this contract: what the brand book states, what was derived and by what
rule, every judgement call *and what it cost*, and what is still open. A brand
file records values; the document records decisions, and it is what lets someone
work on the theme without the source book in front of them.

`_example.scss` is the reference for the file itself. It is worth reading before writing a brand,
because it answers the question the token list does not: swapping the seed is
**not** enough. The stock neutrals carry an indigo tint
(`--color-background-hover`, `--color-surface-variant`, `--color-background-active`),
the admin chrome is an unrelated palette, and a few tokens hold a hue no
derivation reaches (`--assist-ink`, the dark `--table-header-bg`). All 39 of the
example's overrides exist for one of those reasons.

### Deploying one

The mechanism above is per-build. Turning it on for a real installation is three
facts, and the first one is the important one.

**A push to `master` deploys PL and UA.** Both workflows trigger on it. Set the
variables *before* pushing, or the deploy that carries the brand file will ship
it with `THEME=stock` and look like nothing happened.

**Set the variables.** GitHub → Settings → Secrets and variables → Actions →
*Variables*. Repository variables, not secrets — none of this is sensitive, and
`vars.*` is checked first.

| Installation | Variables | Trigger |
|---|---|---|
| PL | `THEME`, `THEME_COLOR` | push to `master`, or Run workflow |
| UA | `UA_THEME`, `UA_THEME_COLOR` | push to `master`, or Run workflow |
| standalone | `THEME`, `THEME_COLOR` as *secrets* — **or pick per run** | Run workflow only |

Standalone is dispatch-only, which makes it the box to try a brand in: the *Run
workflow* form has a **Brand** dropdown that overrides the secret for that run
only. Leave it on `repository setting` for the normal path. A brand added under
`src/brand/` needs adding to that list in `deploy-standalone.yml`.

Locally with Docker, the same choice is one variable:

```
THEME=example THEME_COLOR=#000000 docker compose build
```

`THEME` is the brand file name without the leading underscore or extension —
`example` for `src/brand/_example.scss`. A name with no matching file
aborts the build, so a typo fails loudly rather than shipping stock.

**The portal name is not `APP_TITLE`.** `APP_TITLE` only seeds the `<title>` tag
and the pre-login fallback. The name the header and browser tab actually show
comes from the database — Admin → Settings → General — served to the app by
`/auth/settings` before it renders. Change it there, no deploy needed.

**Rolling back** is setting the variable to `stock` and re-running the workflow.
Nothing else is installation-specific, so there is no state to unwind.

### The live escape hatch

`src/assets/theme-overrides.css` is linked at the end of `<body>` — after the
Angular CLI's stylesheet, which it appends to the end of `<head>` — so anything
in it wins. Ships empty (present rather than absent, so a stock install does not
404 on it). Edit it on a server for a tweak that cannot wait for a redeploy.

It is an escape hatch, not the mechanism: nothing in it is reviewed, versioned,
or checked. Anything that outlives the afternoon belongs in a brand file.

It is also **wiped by the next deploy**. PL and UA unpack each release into
`/var/www/b2b/releases/<timestamp>` and swap the `current` symlink, so an edit
made in `current/assets/` belongs to that release and not to the next one. Use
it to try a colour on a live site, then put the value in the brand file.

---

## 7. Known gaps

Not built, deliberately.

- **Favicon and PWA icons.** `src/assets/favicon/*` and `src/assets/icons/*` are
  still one set for all installations, and `manifest.webmanifest` carries its own
  theme and background colour. Only `src/assets/branding/` is swapped per brand,
  because clobbering tracked binaries in a developer's working tree during a
  build is a bad trade. A brand needing its own favicon wants a different
  mechanism — most likely a deploy-time copy, not a `set-env` one.
- **Self-hosted fonts.** `scripts/brand-fonts.js` models one Google Fonts
  `<link>` per theme, which covers an OFL face. A commercial licence needs its
  `.woff2` files under `src/assets` and an `@font-face` block, and nothing
  serves those per-installation yet; such a theme wants `href: null` and its
  `@font-face` in the brand stylesheet. Not built, because no brand needs it yet —
  a brand asking for a commercial face has so far substituted an OFL one.
- **Activity-type palette.** `crm/components/activity-timeline.component.ts`
  holds a 12-colour categorical ramp as TypeScript literals. Neither semantic nor
  user data, so by §3 it should be tokens — but inventing 12 dark-mode values is
  a design decision.
- **Non-colour `var()` fallbacks.** `var(--spacing-lg, 24px)` and friends are
  still scattered around. Same failure mode as rule 2, different axis; check 2
  covers colour only.
- **Emoji as icons.** `crm/**` templates still use `&#128100;` and friends,
  against `DESIGN_POLICY.md` §11. Unrelated to theming, found while grepping.
