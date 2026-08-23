# Admin Design System — Migration Tracker

Tracks the page-by-page rollout of the `.adm-*` design system defined in `DESIGN_POLICY.md`. Reference implementations are the source of truth — visual changes to them require updating both pages **and** the relevant shared partial.

**Legend**
- ✅ Migrated — uses `.adm-*` classes only, no page-local prefix, no hardcoded tokens.
- 🟡 Partial — partially migrated; remaining work noted.
- ⬜ Pending — original styling intact.
- ⭐ Reference — defines the visual language; do not regress.
- ➖ N/A — not part of the admin shell pattern (modals, embedded widgets, sub-components inside a parent page).

**Conventions**
- Path is relative to `src/app/admin/`.
- "Kind" indicates the page archetype: `editor` (sidebar+sections), `list` (table or grid), `dashboard` (charts/cards), `settings` (form-only).
- Update this file in the same PR that migrates a page.

---

## Reference pages

| Status | Route | Path | Kind | Notes |
|---|---|---|---|---|
| ✅⭐ | `/admin/users/edit/:uid` | `users/user-edit` | editor | Re-pointed `ue-*` → shared `.adm-*`; component SCSS now empty (`:host` only). |
| ✅⭐ | `/admin/profile` | `profile` | editor | Re-pointed `pf-*` → shared `.adm-*`; SCSS empty. Promoted `.adm-actions` to the shared forms partial. |

> **Refactor note**: reference re-pointing **done** — both pages consume the shared partials with zero page-local CSS, confirming `.adm-*` covers the editor + profile patterns. The `:has()` gap-fix in `admin.component.scss` is keyed off `.adm-page` only.

---

## Editor pages (sidebar + numbered sections)

| Status | Route | Path | Notes |
|---|---|---|---|
| ✅ | `/admin/clients/edit/:uid` | `clients/client-edit` | Validated `.adm-role-grid` for non-user enums (discount mode / cumulative mode). Address modal + country autocomplete remain page-local (`ce-modal`, `ce-autocomplete`). Address cards also page-local. Bundle 85→71kB. |
| ✅ | `/admin/tags/edit/:uid` | `tags/tag-edit` | First migration. Added page-local `tag-preview-chip` + native color-picker styling (not yet generalized). |
| ✅ | `/admin/shipment/carriers/edit/:uid` | `shipment/carriers/carrier-edit` | API URL + UID both copyable via `[copyOnClick]`. Sidebar avatar uses `local_shipping` material icon instead of initials. Connection-test result reuses `.adm-success`/`.adm-error`. Event-mappings list is page-local (`cre-events`). |
| ✅ | `/admin/orders/new` | `orders/order-create` | Client search/select → create draft. Shell + single `.adm-section`; client autocomplete page-local (`oc-autocomplete`). Cancel/Create in bar. |
| ✅ | `/admin/orders/edit/:uid` | `orders/order-edit` | Bar actions: Cancel + Confirm (draft) + Save. Sections: client+pricing, items (page-local rows + qty stepper + product search), preview totals, address. `.adm-input`/`.adm-icon-btn` reused; complex item/preview/search bits page-local (`oe-*`). |
| 🟡 | `/admin/orders/:uid` | `orders/order-detail` | **Shell migrated**: header → `.adm-bar` (actions icon-only on mobile), `.adm-page` + `.adm-grid--full`, `.adm-loading`/`.adm-error`. SCSS budget warning **resolved** (43.65→<40kB by removing the now-redundant header/card/loading rules). **Remaining**: body subsections (items/totals/invoices/shipments), status chips, and the 5 modals are still page-local (`.section`, `.modal-*`) — need a focused, visually-verified pass to adopt `.adm-section`/`ce-modal` + shared primitives. |

## List pages (table or grid; `.adm-grid--full`)

| Status | Route | Path | Notes |
|---|---|---|---|
| ✅ | `/admin/users` | `users/users` | Filter panel renders as its own `.adm-section` when expanded (toggled from a ghost button in the bar). Role chips reuse `.adm-role-chip[data-role]` — page no longer maintains its own role-color CSS. Bundle 63→49kB. |
| ⬜ | `/admin/clients` | `clients/clients` | Same shape as users. |
| ✅ | `/admin/orders` | `orders/orders` | Filter panel as `.adm-section` (status/store/manager/search). Table (clickable rows) + mobile cards page-local. Status chip page-local (`ord-status`) keyed off `getStatusClass()` using existing `--status-*-text` tokens. Delete = `.adm-icon-btn--danger` (admin only). |
| ✅ | `/admin/products` | `products/products` | Read-only catalog. Filter panel as `.adm-section` (5 fields). Table + mobile cards page-local; product tag badges keep per-tag color (added `textColorFor()`); active status as `prd-dot`; product UID copyable. `is_new` shown as `.adm-role-chip`. |
| ✅ | `/admin/stores` | `stores/stores` | Expandable cards w/ inline edit form (per-card save — independent). Country/active shown as `.adm-role-chip`; store ID via `[copyOnClick]` (removed dead `copyUid()`/`copiedUid`). Card list page-local (`sto-card`). |
| ✅ | `/admin/tags` | `tags/tags` | First list migration. Replaced `app-action-bar` with `.adm-bar`. Table/mobile-card kept page-local pending a future table partial. Added `.adm-icon-btn--danger` variant. |
| ✅ | `/admin/tables` | `tables/tables` | DB-table viewer. Controls (table/field selects + search + pagination) in an `.adm-section` collapsible on mobile via bar toggle. Records table + cards page-local; value-type classes (`value-null/number/money/...`) preserved. |
| ✅ | `/admin/invoice` | `invoice/invoice` | Two-tab (types/history) with `inv-tab` pills (icon+label). Tables page-local; in-row active switch uses new shared `.adm-toggle--bare`. Status chips page-local. Type modal mirrors `ce-modal` w/ dynamic headers editor + test result. Added **`.adm-toggle--bare`** to shared partial. |
| ✅ | `/admin/logs` | `logs/logs` | Filter panel as `.adm-section` (6 fields, search uses `.adm-pwd` row). Desktop table + mobile cards with expandable rows page-local. Level chip page-local (`log-level`). `copyMessage()` kept (copies composed message+meta, not just text). |
| ✅ | `/admin/webhooks` | `webhooks/webhooks` | Two-tab section (webhooks/deliveries) — `wh-tab` pills in bar (same pattern as `tg-tab`). Webhook cards + expandable delivery cards page-local. URL copyable; delivery detail copy buttons use `[copyOnClick]` (removed dead `copyToClipboard()`). Edit modal mirrors `ce-modal`. Status chip page-local (`wh-status`). |
| ✅ | `/admin/shipment/carriers` | `shipment/carriers/carriers` | Card grid (auto-fill `minmax(360, 1fr)`) page-local. Store scope chip lives inline in the breadcrumb. Bundle 115→104kB. |
| ⬜ | `/admin/shipment/boxes` | `shipment/boxes/boxes` |  |
| ⬜ | `/admin/telegram/invites` | `telegram/invites/invites` |  |
| ⬜ | `/admin/telegram/subscriptions` | `telegram/subscriptions/subscriptions` |  |

## Settings pages (form-only, often no sidebar)

| Status | Route | Path | Notes |
|---|---|---|---|
| ✅ | `/admin/settings` | `settings/settings` | Hub page (nav-card grid, not a form). `.adm-bar` + `.adm-grid--full`; card grid page-local (`set-card`). Added OnPush. |
| ✅ | `/admin/settings/maintenance` | `settings/maintenance/maintenance-settings` | Single-form settings page; actions in the bar (no bottom footer). `.adm-toggle` for enable, constrained to 720px (`mnt-main`). |
| ✅ | `/admin/mail/settings` | `mail/settings` | Multi-section settings; single primary Save in the bar (both legacy per-form saves called the same `saveSettings()`). Status chip + `.adm-meta` for read-only status. API-key + test-email rows reuse `.adm-pwd`. Restart/test/connection status are section-level actions. |
| ✅ | `/admin/shipment/settings` | `shipment/settings` | Single bar Save. Store filter is a thin top section; status chip + `.adm-meta`; active-carriers list page-local (`ship-carrier`) with `.adm-role-chip` status. Carriers/Boxes nav are bar actions (icon-only on mobile). |
| ✅ | `/admin/telegram/settings` | `telegram/settings` | Section tab-nav (subscriptions/invites/settings) lives in the bar crumb area as page-local `tg-tab` pills. Status chip + `.adm-meta`; API-key + test via `.adm-pwd`. **Note:** `tg-tab` pattern should be promoted/reused when telegram/subscriptions + invites migrate. |
| ✅ | `/admin/crm/settings` | `crm/pages/settings` | `app-crm-nav` sits in the bar crumb area. Drag-drop stage list + transitions matrix + color-picker modal kept page-local (`crm-stage`, `crm-matrix`, `crm-modal`, `crm-color`). Stage checkboxes → `.adm-toggle`; stage ID → `[copyOnClick]`. Modal mirrors `ce-modal` pattern. |

## Dashboard / specialized pages

| Status | Route | Path | Notes |
|---|---|---|---|
| ✅ | `/admin/dashboard` | `dashboard/dashboard` | Store select in bar. KPI cards page-local (`dsh-stat`, auto-fill grid) — candidate to promote to shared `.adm-kpi-card` if reused. Discount-scale table in `.adm-section`. |
| 🟡 | `/admin/crm/dashboard` | `crm/pages/dashboard` | **Shell migrated**: `app-crm-nav` in bar, filters toggle → `.adm-section`, `.adm-loading`/`.adm-error`, `.adm-page`+grid. Removed dead loading/error/retry SCSS. Rich body (summary KPI cards, pipeline bars, task grid, workload, activity feed) kept page-local — visualization-heavy, left for a focused pass. |
| 🟡 | `/admin/crm/my-tasks` | `crm/pages/my-tasks` | **Shell migrated**: crm-nav in bar, status select (`.adm-input`) + overdue toggle in actions, `.adm-loading`/`.adm-error`, empty → `.adm-section`. Task-group/task-card body kept page-local. Removed dead bar/loading/spinner SCSS. |
| 🟡 | `/admin/crm/workload` | `crm/pages/workload` | **Shell migrated**: crm-nav in bar, filters → `.adm-section`, `.adm-loading`/`.adm-error`, empty → `.adm-section`. Summary cards + workload table kept page-local. Removed dead loading/spinner/empty SCSS. |
| 🟡 | `/admin/crm` | `crm/crm` | **Shell migrated**: crm-nav in bar, filters → `.adm-section`, `.adm-loading`/`.adm-error`. Kept `.crm-container` height/flex/overflow (kanban needs internal scroll) + added `.adm-page` for the gap fix. Order-details slide-in panel: buttons → `.adm-crumb-back`/`.adm-icon-btn`/`.adm-btn` (responsive show/hide preserved). `app-pipeline-board` is a separate component (its own kanban styling untouched). |
| ➖ | `/admin/chat` | `chat/chat` | Bespoke 3-pane messaging layout, no header bar — intentionally NOT migrated to the shell. Already token-clean. |
| ✅ | `/admin/chat-service` | `chat-service/chat-service` | Settings page. Bar (Settings / Chat service · refresh · Save). Sections: connection (status chip, enabled toggle, base URL, auth token via `.adm-pwd`), collapsible endpoints, platforms (presets + `.adm-toggle--bare` per-row), status `.adm-meta`. Platform list page-local (`cs-platform`). |

## Subcomponents (not pages — apply primitives only)

These render inside parent pages and shouldn't recreate the shell. Migrate their internal form/button styling only.

| Status | Path | Notes |
|---|---|---|
| ➖ | `crm/components/activity-timeline` | Embedded widget. |
| ➖ | `crm/components/assignment-modal` | Modal — use `.adm-section` body, ghost/primary buttons. |
| ➖ | `crm/components/crm-nav` | Tab nav. |
| ➖ | `crm/components/dashboard-filters` | Form primitives only. |
| ➖ | `crm/components/order-card` | Card list item. |
| ➖ | `crm/components/pipeline-board` | Kanban. |
| ➖ | `crm/components/task-list` | List inside CRM pages. |
| ➖ | `chat/components/chat-list` |  |
| ➖ | `chat/components/chat-window` |  |
| ➖ | `chat/components/message-input` |  |

---

## Suggested migration order

1. **`tags/tag-edit`** — smallest editor; validates shell + forms end-to-end on a low-risk page.
2. **`tags/tags`** — paired list page; validates `.adm-grid--full` and `.adm-bar` on a list.
3. **`clients/client-edit`** — heavier editor with selects + numeric fields; surfaces gaps in form primitives.
4. **`shipment/carriers/*`** — paired list + editor.
5. **`users/users`** — high-traffic list; second-pass validation.
6. **Settings cluster** — `settings/`, `mail/settings/`, `shipment/settings/`, `telegram/settings/`. All similar shape, batch into one PR each or paired.
7. **`orders/*`** — heaviest cluster, including the 40kB `order-detail`. Tackle after partials are battle-tested.
8. **Dashboards** — likely need a new `.adm-kpi-card` partial; address only when we hit them.
9. **Reference re-pointing** — switch `users/user-edit` and `profile` from `ue-*`/`pf-*` to `.adm-*`, then delete those prefixed blocks.
10. **CRM + chat** — bespoke layouts; treat as a separate epic.

---

## Per-PR checklist

Copy into the PR description for each migration:

```
- [ ] Used `.adm-*` classes exclusively; no new page-local BEM prefix.
- [ ] No hardcoded sizes / hex colors / radii in page SCSS.
- [ ] Page SCSS reduced to page-specific layout only (< 80 lines target).
- [ ] Verified light + dark themes.
- [ ] Verified keyboard focus on all interactive elements.
- [ ] `npm run build:prod` clean (no new size-budget warnings).
- [ ] Updated `DESIGN_MIGRATION.md` row to ✅.
- [ ] If a missing primitive surfaced: added to the relevant `_*.scss` partial AND noted in this PR description.
```
