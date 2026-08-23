# Brand assets

One directory per brand, matching the `THEME` name and the
`src/brand/_<name>.scss` that goes with it. `scripts/set-env.js` copies the
selected one over `src/assets/branding/` before the build, so a template
referring to `assets/branding/logo.png` gets the right file without knowing
which brand is active.

Only this directory is swapped. The favicon and PWA icon sets under
`src/assets/favicon/` and `src/assets/icons/` are **not** per-brand yet — see
"Known gaps" in `docs/development/theming-contract.md`.

A brand with no directory here keeps the committed contents of
`src/assets/branding/`, which are the stock ones.

```
branding/
  stock/logo.png      <- header logo, 192x192
  <yours>/logo.png
```
