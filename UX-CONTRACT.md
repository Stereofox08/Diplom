# ByteStore UI contract

## Product context

Russian-language computer store in Kazakhstan; KZT; Asia/Almaty. Customer web/Android and staff-only macOS/Windows administration share existing APIs. Accessibility target is WCAG 2.2 AA for owned web surfaces; native platform conventions apply on Android/macOS/Windows.

The original redesign scope is **visual-only**; the subsequent explicit request also repairs Android configurator parity (see below). Preserve functionality, content, routing, confirmation/validation ownership, state persistence and server invariants. This document records existing owners rather than authorizing a behavioral migration. No new locale, permission, payment, privacy or deletion rules are introduced.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Permission model | `README.md`, `supabase/schema.sql` | Maintained architecture + server authorization | 2026-10-25 |
| Orders/inventory/payment | `README.md`, `supabase/schema.sql`, `js/cloud/client.js` | API/domain implementation | 2026-10-25 |
| Native stock verification/cache/session | `android-store/README.md`, `Store.java`, `MainActivity.java` | User-approved native app contract | 2026-10-25 |
| Deletion and received/cancelled lifecycle | `supabase/schema.sql` | Server state transitions | 2026-10-25 |
| Legal/privacy/content | Existing product copy; no changes authorized | Existing maintained content | 2026-10-25 |
| Mobile structure | User's DNS screenshots and latest approval | Explicit user decision | 2026-10-25 |

## Visual contract

`DESIGN.md` describes the identity. `design/tokens.json` owns runtime values; `design/generate.py` emits platform adapters. Native OS chrome and popups are accepted platform variants. Web supports its existing dark/light themes; Android defaults to the shared light theme and offers light/dark/system selection in Profile → Settings. The choice persists locally, recreation retains navigation and drafts; dialogs, system bars and all owned screens follow the selected palette. Web theme switching remains available.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Existing native HTML select / Android Spinner | Existing forms and platform behavior | native | Browser open state + Android smoke |
| Date | Existing HTML date/native platform picker | Existing admin form behavior | native | Admin form inspection |
| Form | `js/pages/auth.js`, `js/pages/cart.js`, `js/admin/*`, Android activity | Existing validation and server contracts | customer / staff / native | Auth/payment regressions + admin render checks |
| Scrollbar | `css/brand-system.css`, native scroll containers | DESIGN.md | native / CSS geometry | Computed style + narrow viewport |
| Toast | `BS.layout` / native Toast and AlertDialog | Existing shared owners | web / native | Existing failure and checkout tests |
| CRUD | `js/cloud/client.js`, shared admin modules / native Api | README + server contracts | role-specific | `tests/shared-database.cjs` prior evidence; no writes for this visual task |

## Behavior ledger

| Operation | Trigger | Pending | Success | Failure | Source ref |
|---|---|---|---|---|---|
| Search/filter | Existing search controls | Existing local/debounce state | Preserve matching/sort/pagination | Preserve no-results/reset | Existing catalogue modules |
| Login/register | Existing forms | Existing duplicate-submit guard | Existing session/confirmation flow | Preserve entered values and messages | Auth modules + API |
| Basket/favorites | Existing controls | Existing per-device ownership | Existing count/persistence | Existing stock feedback | Store modules |
| Checkout | Existing action/payment dialogs | Existing submit/idempotency | Existing order history | Existing stock/price rejection/retry | README + checkout RPC |
| Admin edit/delete | Existing staff controls | Existing server acknowledgement | Existing refresh/notification | Existing permission/conflict handling | Admin modules + schema |
| Back/cancel | Existing navigation/overlay controls | Not applicable | Existing focus/history/scroll behavior | Preserve current fallback | Layout module / native activity |

## Ownership and states

No operation label, API payload, business handler, search algorithm, token persistence, loading semantics, form validation, confirmation threshold or destination changes in this redesign. Existing web dialogs/drawers and body-level tooltips remain shared owners. Native dialogs/menus remain native. CSS adds only focus/hover/pressed/disabled presentation and a global scrollbar baseline. Existing user-visible behavior gaps are outside this visual-only request and must not be silently redefined as new policy.

## Verification

Run token drift check, static premium audit over the visual migration sources, web responsive/auth/payment/tooltip tests, admin visual-state checks, Android build/lint/native instrumentation and read-only screen checks, macOS app build/signature and Windows package/smoke checks where available. Never create real orders, send email or edit inventory to verify styling. Check at least one narrow viewport and both web themes, open popup/overlay, long labels, focus, loading and failure states. Record platform limitations honestly in `docs/verification.md`.

## Configurator parity repair — explicitly requested 2026-10-25

Android defaults to manual assembly: eight core slots plus monitor, keyboard, mouse and headset. Product IDs persist locally; prices and stock are resolved from the current shared catalogue. Selection, replacement, removal, reset, compatibility, power estimate, price, FPS estimate, cart transfer and native specification sharing are available. Automatic selection remains a separate path with budget, five tasks, resolution, CPU brand, cooling and optional monitor/peripherals; results transfer back to manual editing. Partial builds follow the website rule: purchasable when selected components are compatible and available. Missing catalogue IDs block purchase until replaced/reset. Final checkout continues to validate live server stock atomically.

The web expert engine generates 2,061 rule vectors consumed by Android instrumentation: sockets, memory, dimensions, cooling, power, warnings, notes, totals and performance estimates. This requested functional correction is the exception to the original visual-only scope.

The user explicitly requested Android dark theme after review. This authorizes the local theme selector and persistence; no account/cart/server behavior changes.
