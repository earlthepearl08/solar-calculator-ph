# Kinmo PW Solar Feasibility Tool

A client-facing solar savings & PV-sizing calculator for the Philippine market, built for
Kinmo PW Corporation as a lead-generation tool. A prospect enters their electricity bill and
site details and gets an instant system size, 25-year ROI/payback, savings projection, and a
path to request a quote or contact sales.

## Stack

- **Front end:** static `index.html` + `script.js` + `style.css` (no framework, no build step).
  `equipment-config.js` holds the editable hardware-recommendation SKUs.
- **AI bill reader (optional):** `api/extract-bill.js` — Vercel serverless function that OCRs
  uploaded Meralco / co-op bills via the Google Gemini API and returns strict JSON.
- **Leads CRM:** Google Sheet as durable store + password-protected `/crm` admin UI.
  - `api/lead.js` — public POST from the calculator form (appends a row)
  - `api/leads.js` — admin GET/PATCH (list + update status/notes)
  - `crm.html` / `crm.js` / `crm.css` — Earl’s lead table
- **Hosting:** Vercel (static site + serverless functions under `/api`).
- **Third-party:** EmailJS (customer + sales email notify) and jsPDF (client-side PDF).
  EmailJS still runs client-side; the Sheet is the CRM source of truth.

## Configuration (Vercel env vars)

Set these in **Vercel → Project Settings → Environment Variables** (see `.env.example`):

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Enables the AI bill reader. If unset, upload returns 503 and UI falls back to manual entry. |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Leads spreadsheet ID (`1jYJNcAPHGtVyvdzVDFudAZXoMGHV8kT0KKUzUVduvE4`) |
| `GOOGLE_SHEETS_TAB` | Optional tab name (default `Sheet1`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email shared as **Editor** on the Sheet |
| `GOOGLE_PRIVATE_KEY` | Service account private key (PEM; use `\n` for newlines in Vercel) |
| `LEADS_WEBHOOK_URL` | Optional Apps Script web app URL (append-only fallback if SA not set) |
| `CRM_ADMIN_PASSWORD` | Password for `/crm` (sent as header/cookie; never expose to the public form) |
| `ALLOWED_ORIGIN` | Optional extra allowed Origin host for API checks |

EmailJS keys (public key, service ID, template IDs) are configured at the top of `script.js`.

### One-time Google Sheet access (Earl)

1. Open [the leads spreadsheet](https://docs.google.com/spreadsheets/d/1jYJNcAPHGtVyvdzVDFudAZXoMGHV8kT0KKUzUVduvE4/edit).
2. Create (or reuse) a Google Cloud **service account**, enable **Google Sheets API**, download a JSON key.
3. Share the spreadsheet with the service-account `client_email` as **Editor**.
4. Paste `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `private_key` → `GOOGLE_PRIVATE_KEY` in Vercel.
5. Set `GOOGLE_SHEETS_SPREADSHEET_ID` and a strong `CRM_ADMIN_PASSWORD`.
6. **Redeploy** so the new env vars apply.
7. Open `https://<your-domain>/crm`, sign in, and confirm a test lead from the calculator appears.

Apps Script webhook steps (append-only fallback) are in the project CRM setup doc / PR description.

## Local preview

It's a static site, so any static server works, e.g.:

```
python3 -m http.server 8000
```

`/api/*` endpoints need `vercel dev` (and the env vars above) to hit Gemini / Sheets.

## Editing hardware recommendations

Update `equipment-config.js` — inverter tiers and the battery unit are read at runtime and drive
only the "Recommended Equipment" card labels (not the savings/ROI math).
