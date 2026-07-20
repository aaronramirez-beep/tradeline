# TradeLine

Field-service CRM for the trades — "from first call to final invoice."
A working demo, positioned as its own brand (deliberately not Ark-branded).

## Files
| File | What it is |
|------|-----------|
| `index.html` | Landing page (the front door — loads first) |
| `app.html`   | The demo CRM (requests → quotes → jobs → invoices → payments, plus pipeline, job costing, AI receptionist, automations, integrations, plan tiers) |
| `brand.css`  | **Shared brand system** — fonts + color tokens, read by both pages. Change the look here once and both pages update. |

The pages link to each other: landing "Try the demo" → `app.html`; the demo's
sidebar and launcher link back to `index.html`. All demo data saves in the
visitor's own browser (localStorage) — one link serves unlimited trial users,
each isolated. No accounts, no backend yet.

## Brand
- **Type:** Big Shoulders Display (headlines), Barlow (body), IBM Plex Mono (labels/data)
- **Color:** navy `#0f1e2e`, steel `#2f6fa8`, warm paper `#f2f0ea`
- All tokens live in `brand.css` as `--tl-*` variables.

## Deploy (Netlify)
Drag this whole folder onto the Netlify **Deploys** tab. To rename the URL:
Site configuration → Change site name (e.g. `tradeline-demo`).

## Roadmap — from demo to real product
The demo is the whole product EXCEPT the part that makes it sellable:
1. **Accounts + shared database** — so a contractor's data lives on a server,
   not one browser. This is the step that turns a demo into SaaS.
2. **Real payments** (Stripe) behind the plan tiers.
3. **Custom domain** (~$10–15/yr) once the name is settled.
4. **Name/trademark check** — "TradeLine" has a credit-industry meaning; confirm
   availability before printing it on anything.
