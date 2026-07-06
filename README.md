# Kinmo PW Solar Feasibility Tool

A client-facing solar savings & PV-sizing calculator for the Philippine market, built for
Kinmo PW Corporation as a lead-generation tool. A prospect enters their electricity bill and
site details and gets an instant system size, 25-year ROI/payback, savings projection, and a
path to request a quote or contact sales.

## Stack

- **Front end:** static `index.html` + `script.js` + `style.css` (no framework, no build step).
  `equipment-config.js` holds the editable hardware-recommendation SKUs.
- **AI bill reader (optional):** `api/extract-bill.js` — a Vercel serverless function that OCRs
  uploaded Meralco / co-op bills via the Google Gemini API and returns strict JSON.
- **Hosting:** Vercel (static site + the serverless function under `/api`).
- **Third-party libs (via CDN):** EmailJS (report + lead email) and jsPDF (client-side PDF).

## Configuration

Set these in **Vercel -> Project Settings -> Environment Variables** (see `.env.example`):

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Enables the AI bill reader. If unset, the upload path returns a 503 and the UI falls back to manual entry. Get one at https://aistudio.google.com/apikey |

EmailJS keys (public key, service ID, template IDs) are configured at the top of `script.js`.

## Local preview

It's a static site, so any static server works, e.g.:

```
python3 -m http.server 8000
```

Note: the `/api/extract-bill` endpoint only runs under `vercel dev` or on a Vercel deployment,
and only when `GEMINI_API_KEY` is set.

## Editing hardware recommendations

Update `equipment-config.js` — inverter tiers and the battery unit are read at runtime and drive
only the "Recommended Equipment" card labels (not the savings/ROI math).
