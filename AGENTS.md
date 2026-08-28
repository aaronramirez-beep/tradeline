# TradeLine

Static demo CRM for field-service contractors. No build step, no backend, no dependencies.

## Structure

- `brand.css` — shared design tokens (`--tl-*` variables), fonts, icon system. **Edit here** to change the look across both pages.
- `index.html` — landing page
- `app.html` — full CRM demo (all JS/CSS inline except lib.js; all references prefixed `TL.*`)
- `lib.js` — extracted pure functions, constants, state factories. Exposed on `window.TL`. Loaded by app.html before inline script.

All demo data is localStorage. No accounts, no server.

## Conventions

- **Fonts:** Plus Jakarta Sans (display/body), JetBrains Mono (labels/data)
- **One accent:** Signal `#00D2A6`. Never a second accent. ~90% neutral, 10% accent per screen.
- **Button rule:** 44px min height, 10px radius, one accent button per view.
- **Icons:** 24px grid, 1.75px stroke, outline only, round caps/joins, one concept per icon. Inline SVG — no icon library.
- **Status pills** are functional, never decorative. Green = money in, amber = waiting, red = act today.
- **Print stylesheet** in `app.html` — quotes/invoices are designed to print to PDF on white.
- CSS class names in `app.html` use legacy short names (`.btn`, `.card`, `.pill`). Brand-utility classes (`.tl-btn`, `.tl-ico`, `.tl-label`) live in `brand.css`.

## Deploy

Drag folder onto Netlify Deploys tab. No build command needed.

## Testing

Requires Node.js (`brew install node`).

```bash
npm install                    # install vitest + playwright
npx playwright install         # one-time browser binary install
npm test                       # unit tests (vitest, jsdom)
npm run test:e2e               # E2E tests (playwright, real browser)
npm run test:all               # both
```

- `tests/lib.test.js` — unit tests for lib.js (money, dates, esc, calculations, feature gating, state)
- `tests/e2e/app.spec.js` — browser E2E tests for critical user flows (boot, navigation, CRUD, paywall, upgrade)
- Pure logic lives in `lib.js` (testable without DOM). DOM-dependent code stays in `app.html`.
