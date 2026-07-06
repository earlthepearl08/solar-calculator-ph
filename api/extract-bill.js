// Vercel serverless function: reads Philippine electricity bills (Meralco or
// provincial co-ops) from uploaded photos/PDFs using the Gemini API and returns
// strict JSON. The API key is read from the GEMINI_API_KEY environment variable.
//
// Request  (POST, application/json):
//   { files: [ { mimeType: "image/jpeg", data: "<base64, no data-url prefix>" }, ... ] }  // 1..12 items
// Response (200):
//   { ok: true, bills: [ { billingMonth, totalAmountDue, totalKwh, effectiveRate,
//                          readable, note, history: [ { month, kwh } ] } ] }
// Errors:
//   503 { ok:false, error }  -> API key not configured (client falls back to manual entry)
//   4xx/5xx { ok:false, error } -> bad request / upstream failure

const GEMINI_MODEL = 'gemini-2.0-flash';
const MAX_FILES = 12;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const RATE_LIMIT = 12;         // max requests per IP...
const RATE_WINDOW_MS = 60000;  // ...per minute (best-effort; only shared within a warm instance)
const rateHits = new Map();

const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        bills: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    billingMonth: { type: 'string', description: 'Billing/statement month e.g. "Mar 2025". Empty if unknown.' },
                    totalAmountDue: { type: 'number', description: 'Total amount due in PHP. 0 if unreadable.' },
                    totalKwh: { type: 'number', description: 'Total kWh consumed for the period. 0 if unreadable.' },
                    effectiveRate: { type: 'number', description: 'Effective PHP per kWh (amount / kWh). 0 if unreadable.' },
                    readable: { type: 'boolean', description: 'true if the bill could be read with reasonable confidence.' },
                    note: { type: 'string', description: 'Short note if something was unclear or missing. Empty otherwise.' },
                    history: {
                        type: 'array',
                        description: 'Monthly consumption history if the bill shows a 12-month table/graph. Empty array if none.',
                        items: {
                            type: 'object',
                            properties: {
                                month: { type: 'string' },
                                kwh: { type: 'number' }
                            },
                            required: ['month', 'kwh']
                        }
                    }
                },
                required: ['billingMonth', 'totalAmountDue', 'totalKwh', 'effectiveRate', 'readable', 'note', 'history']
            }
        }
    },
    required: ['bills']
};

const PROMPT = [
    'You are reading Philippine residential/commercial electricity bills (Meralco or provincial electric cooperatives).',
    'Each uploaded file is ONE bill (a photo or PDF). Return one entry in "bills" per file, in the same order as provided.',
    'For each bill extract:',
    '- billingMonth: the statement/billing month (e.g. "Mar 2025").',
    '- totalAmountDue: the TOTAL AMOUNT DUE in Philippine Pesos as a number (no currency symbol, no commas).',
    '- totalKwh: total kWh consumed for that billing period as a number.',
    '- effectiveRate: PHP per kWh. If both amount and kWh are present, compute totalAmountDue / totalKwh; otherwise read it if printed.',
    '- readable: true only if you could read the key figures with reasonable confidence; false if the image is blurry, cropped, or not an electricity bill.',
    '- note: a short human-readable note ONLY if something was unclear or missing (else empty string).',
    '- history: if the bill shows a monthly consumption history table or bar graph (Meralco bills usually show ~12 months), extract each { month, kwh }. If none, return an empty array.',
    'Never invent numbers. If a value is missing or unreadable use 0 and set readable=false with a note. Amounts are PHP.'
].join('\n');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
        return;
    }

    // Only accept calls from our own site (or Vercel preview deploys) to protect the paid key.
    const reqHost = String(req.headers.host || '').toLowerCase();
    const originHeader = req.headers.origin || req.headers.referer || '';
    if (originHeader) {
        try {
            const originHost = new URL(originHeader).host.toLowerCase();
            const allowed = originHost === reqHost || originHost.endsWith('.vercel.app') ||
                (process.env.ALLOWED_ORIGIN && originHost === process.env.ALLOWED_ORIGIN.toLowerCase());
            if (!allowed) { res.status(403).json({ ok: false, error: 'Forbidden.' }); return; }
        } catch (e) { /* malformed Origin header — fall through */ }
    }

    // Best-effort per-IP rate limit (shared only within a warm serverless instance).
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const nowTs = Date.now();
    const recentHits = (rateHits.get(ip) || []).filter(t => nowTs - t < RATE_WINDOW_MS);
    if (recentHits.length >= RATE_LIMIT) {
        res.status(429).json({ ok: false, error: 'Too many requests. Please wait a minute and try again.' });
        return;
    }
    recentHits.push(nowTs);
    rateHits.set(ip, recentHits);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        res.status(503).json({ ok: false, error: 'AI bill reading is not configured on the server. Please enter your bill details manually.' });
        return;
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
    }
    const files = body && Array.isArray(body.files) ? body.files : null;

    if (!files || files.length === 0) {
        res.status(400).json({ ok: false, error: 'No files were uploaded.' });
        return;
    }
    if (files.length > MAX_FILES) {
        res.status(400).json({ ok: false, error: `Please upload at most ${MAX_FILES} bills at a time.` });
        return;
    }

    const parts = [{ text: PROMPT }];
    for (const f of files) {
        if (!f || !f.data || !f.mimeType) {
            res.status(400).json({ ok: false, error: 'One of the uploaded files was invalid.' });
            return;
        }
        if (!ALLOWED_MIME.includes(String(f.mimeType).toLowerCase())) {
            res.status(400).json({ ok: false, error: 'Unsupported file type. Please upload a JPG, PNG, or PDF.' });
            return;
        }
        parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA
        }
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        const gRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!gRes.ok) {
            const detail = await gRes.text().catch(() => '');
            console.error('Gemini error', gRes.status, detail.slice(0, 500));
            res.status(502).json({ ok: false, error: 'Could not read the bill right now. Please try again or enter details manually.' });
            return;
        }

        const data = await gRes.json();
        const text = data && data.candidates && data.candidates[0]
            && data.candidates[0].content && data.candidates[0].content.parts
            && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;

        if (!text) {
            res.status(502).json({ ok: false, error: 'The bill could not be read. Please try a clearer photo or enter details manually.' });
            return;
        }

        let parsed;
        try { parsed = JSON.parse(text); } catch (e) {
            res.status(502).json({ ok: false, error: 'The bill could not be read. Please try a clearer photo or enter details manually.' });
            return;
        }

        const bills = Array.isArray(parsed.bills) ? parsed.bills : [];
        res.status(200).json({ ok: true, bills });
    } catch (err) {
        console.error('extract-bill failure', err && err.message);
        res.status(502).json({ ok: false, error: 'Could not reach the bill reader. Please check your connection or enter details manually.' });
    }
};
