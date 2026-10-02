# Task Tracker

Shared to-do list for the Solar Feasibility Tool. See `README.md` for architecture.

## File map
- **UI:** `index.html`
- **App logic (sizing, ROI, charts, wizard, bill reader, PDF, email):** `script.js`
- **Styles:** `style.css`
- **Hardware recommendation SKUs:** `equipment-config.js`
- **AI bill OCR (Vercel serverless):** `api/extract-bill.js`

## Active
- [x] **Lead delivery:** each submitted lead is emailed to `notifyEmail` in `script.js`
      (currently `earldy.kpwunibest@gmail.com`) using the existing template, with reply_to set to
      the customer. Change `notifyEmail` to route leads to a different inbox.
- [x] **Promo path (2026-10):** site-assessment CTA, lead qualifiers, 3-step residential wizard,
      FAQ / things-to-know / process strip, calc hygiene, bill-OCR friendly fallback, meta/OG.
- [x] **Leads CRM (Google Sheet):** `/api/lead` append + `/api/leads` admin + `/crm` UI.
      Requires Vercel env vars + sharing the Sheet with the service account (see README).
- [ ] **AI bill reader:** after adding `GEMINI_API_KEY` in Vercel, **redeploy** (env vars only
      apply to deployments built after they are added) — Deployments tab → ⋯ → Redeploy.

## Backlog (from the 2026-07 review)
- [x] Durable lead sink (Google Sheet / Airtable) via a `/api/lead.js` function.
- [x] Trim the setup wizard to ~3 residential steps.
- [x] Add a "Book a free site assessment" action.
- [x] Add qualifier fields to the lead form (timeframe, budget band, preferred channel).
