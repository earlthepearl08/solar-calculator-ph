// POST /api/lead — public lead capture from the calculator form.
// Appends a row to the Kinmo Google Sheet (service account) or LEADS_WEBHOOK_URL.
// EmailJS still runs client-side; this endpoint is the durable store.

const {
    appendLead,
    checkOrigin,
    isConfigured
} = require('./_sheets');

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60000;
const rateHits = new Map();

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
        return;
    }

    if (!checkOrigin(req)) {
        res.status(403).json({ ok: false, error: 'Forbidden.' });
        return;
    }

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const nowTs = Date.now();
    const recent = (rateHits.get(ip) || []).filter((t) => nowTs - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_LIMIT) {
        res.status(429).json({ ok: false, error: 'Too many requests. Please wait a minute and try again.' });
        return;
    }
    recent.push(nowTs);
    rateHits.set(ip, recent);

    if (!isConfigured()) {
        res.status(503).json({
            ok: false,
            error: 'Lead store is not configured. Set GOOGLE_SHEETS_* service-account vars or LEADS_WEBHOOK_URL.'
        });
        return;
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
    }
    if (!body || typeof body !== 'object') {
        res.status(400).json({ ok: false, error: 'Expected JSON body.' });
        return;
    }

    // Honeypot — silent success so bots think it worked
    if (body.website_url || body.website) {
        res.status(200).json({ ok: true, skipped: true });
        return;
    }

    try {
        const lead = await appendLead(body);
        res.status(200).json({ ok: true, id: lead.id });
    } catch (err) {
        const status = err && err.status ? err.status : 502;
        console.error('lead append failed', err && err.message);
        res.status(status).json({ ok: false, error: (err && err.message) || 'Could not save lead.' });
    }
};
