// Shared Google Sheets helpers for Kinmo PW leads CRM.
// Primary: Sheets API v4 via service-account JWT (no npm deps).
// Fallback (append-only): LEADS_WEBHOOK_URL Apps Script doPost.

const crypto = require('crypto');

const HEADER_ROW = [
    'id', 'createdAt', 'name', 'email', 'phone', 'location',
    'timeframe', 'budget', 'channel',
    'systemCapacity', 'systemType', 'projectScale',
    'monthlyBill', 'monthlySavings', 'paybackYears', 'systemCost',
    'status', 'notes'
];

const STATUS_VALUES = ['new', 'contacted', 'qualified', 'won', 'lost'];
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

let cachedToken = null;
let cachedTokenExp = 0;

function sheetTab() {
    return String(process.env.GOOGLE_SHEETS_TAB || 'Sheet1').trim() || 'Sheet1';
}

function spreadsheetId() {
    return String(process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();
}

function privateKey() {
    let key = String(process.env.GOOGLE_PRIVATE_KEY || '');
    // Vercel UI often stores newlines as literal \n
    key = key.replace(/\\n/g, '\n').trim();
    return key;
}

function hasServiceAccount() {
    return !!(
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
        privateKey() &&
        spreadsheetId()
    );
}

function hasWebhook() {
    return !!String(process.env.LEADS_WEBHOOK_URL || '').trim();
}

function isConfigured() {
    return hasServiceAccount() || hasWebhook();
}

function base64url(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

async function getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedTokenExp > now + 60) return cachedToken;

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = privateKey();
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = base64url(JSON.stringify({
        iss: email,
        scope: SHEETS_SCOPE,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    }));
    const unsigned = `${header}.${claim}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsigned);
    sign.end();
    const signature = sign.sign(key, 'base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    const jwt = `${unsigned}.${signature}`;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.access_token) {
        const msg = (data.error_description || data.error || resp.statusText || 'token error');
        throw new Error('Google auth failed: ' + msg);
    }
    cachedToken = data.access_token;
    cachedTokenExp = now + (Number(data.expires_in) || 3600);
    return cachedToken;
}

async function sheetsFetch(path, options = {}) {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId()}${path}`;
    const resp = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
    if (!resp.ok) {
        const msg = (data && data.error && data.error.message) || text.slice(0, 200) || resp.statusText;
        const err = new Error('Sheets API: ' + msg);
        err.status = resp.status;
        throw err;
    }
    return data;
}

function leadToRow(lead) {
    return HEADER_ROW.map((key) => {
        const v = lead[key];
        if (v == null) return '';
        return String(v);
    });
}

function rowToLead(row, rowNumber) {
    const lead = { _row: rowNumber };
    HEADER_ROW.forEach((key, i) => {
        lead[key] = row[i] != null ? String(row[i]) : '';
    });
    return lead;
}

function normalizeLeadInput(body) {
    const id = String(body.id || '').trim() ||
        ('L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
    const createdAt = String(body.createdAt || '').trim() || new Date().toISOString();
    const status = STATUS_VALUES.includes(String(body.status || '').toLowerCase())
        ? String(body.status).toLowerCase()
        : 'new';

    return {
        id,
        createdAt,
        name: String(body.name || '').trim(),
        email: String(body.email || '').trim(),
        phone: String(body.phone || '').trim(),
        location: String(body.location || '').trim(),
        timeframe: String(body.timeframe || '').trim(),
        budget: String(body.budget || '').trim(),
        channel: String(body.channel || '').trim() || 'Any',
        systemCapacity: body.systemCapacity != null ? String(body.systemCapacity) : '',
        systemType: String(body.systemType || '').trim(),
        projectScale: String(body.projectScale || '').trim(),
        monthlyBill: body.monthlyBill != null ? String(body.monthlyBill) : '',
        monthlySavings: body.monthlySavings != null ? String(body.monthlySavings) : '',
        paybackYears: body.paybackYears != null ? String(body.paybackYears) : '',
        systemCost: body.systemCost != null ? String(body.systemCost) : '',
        status,
        notes: String(body.notes || '').trim()
    };
}

async function appendViaWebhook(lead) {
    const url = String(process.env.LEADS_WEBHOOK_URL).trim();
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead)
    });
    if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error('Webhook append failed (' + resp.status + '): ' + t.slice(0, 160));
    }
    return lead;
}

async function appendViaApi(lead) {
    const tab = sheetTab();
    await sheetsFetch(`/values/${encodeURIComponent(tab + '!A:R')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        body: JSON.stringify({ values: [leadToRow(lead)] })
    });
    return lead;
}

async function appendLead(rawBody) {
    const lead = normalizeLeadInput(rawBody || {});
    if (!lead.name || !lead.email) {
        const err = new Error('name and email are required');
        err.status = 400;
        throw err;
    }
    if (hasServiceAccount()) return appendViaApi(lead);
    if (hasWebhook()) return appendViaWebhook(lead);
    const err = new Error('Lead store not configured');
    err.status = 503;
    throw err;
}

async function listLeads() {
    if (!hasServiceAccount()) {
        const err = new Error('CRM list requires Google service account credentials');
        err.status = 503;
        throw err;
    }
    const tab = sheetTab();
    const data = await sheetsFetch(`/values/${encodeURIComponent(tab + '!A:R')}?majorDimension=ROWS`);
    const rows = Array.isArray(data.values) ? data.values : [];
    if (rows.length === 0) return [];

    // Skip header if present
    let start = 0;
    if (rows[0] && String(rows[0][0]).toLowerCase() === 'id') start = 1;

    const leads = [];
    for (let i = start; i < rows.length; i++) {
        const row = rows[i] || [];
        if (!row.length || (!row[0] && !row[2] && !row[3])) continue;
        leads.push(rowToLead(row, i + 1)); // 1-indexed sheet row
    }
    // Newest first
    leads.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return leads;
}

async function updateLead(id, patch) {
    if (!hasServiceAccount()) {
        const err = new Error('CRM update requires Google service account credentials');
        err.status = 503;
        throw err;
    }
    const targetId = String(id || '').trim();
    if (!targetId) {
        const err = new Error('Lead id is required');
        err.status = 400;
        throw err;
    }

    const tab = sheetTab();
    const data = await sheetsFetch(`/values/${encodeURIComponent(tab + '!A:R')}?majorDimension=ROWS`);
    const rows = Array.isArray(data.values) ? data.values : [];
    let start = 0;
    if (rows[0] && String(rows[0][0]).toLowerCase() === 'id') start = 1;

    let rowIndex = -1;
    let existing = null;
    for (let i = start; i < rows.length; i++) {
        if (String((rows[i] || [])[0] || '') === targetId) {
            rowIndex = i + 1;
            existing = rowToLead(rows[i], rowIndex);
            break;
        }
    }
    if (rowIndex < 0) {
        const err = new Error('Lead not found');
        err.status = 404;
        throw err;
    }

    const next = { ...existing };
    if (patch.status != null) {
        const s = String(patch.status).toLowerCase().trim();
        if (!STATUS_VALUES.includes(s)) {
            const err = new Error('Invalid status. Use: ' + STATUS_VALUES.join('|'));
            err.status = 400;
            throw err;
        }
        next.status = s;
    }
    if (patch.notes != null) {
        next.notes = String(patch.notes);
    }

    // Update status (col Q = 17) and notes (col R = 18)
    const range = `${tab}!Q${rowIndex}:R${rowIndex}`;
    await sheetsFetch(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({ values: [[next.status, next.notes]] })
    });

    delete next._row;
    return next;
}

function checkOrigin(req) {
    const reqHost = String(req.headers.host || '').toLowerCase();
    const originHeader = req.headers.origin || req.headers.referer || '';
    if (!originHeader) return true; // same-origin navigations / curl without Origin
    try {
        const originHost = new URL(originHeader).host.toLowerCase();
        return originHost === reqHost ||
            originHost.endsWith('.vercel.app') ||
            (process.env.ALLOWED_ORIGIN && originHost === process.env.ALLOWED_ORIGIN.toLowerCase());
    } catch (e) {
        return true;
    }
}

function parseCookies(req) {
    const raw = String(req.headers.cookie || '');
    const out = {};
    raw.split(';').forEach((part) => {
        const i = part.indexOf('=');
        if (i < 0) return;
        const k = part.slice(0, i).trim();
        const v = decodeURIComponent(part.slice(i + 1).trim());
        if (k) out[k] = v;
    });
    return out;
}

function extractAdminPassword(req) {
    const header = req.headers['x-crm-password'] || req.headers['X-CRM-Password'];
    if (header) return String(header);
    const auth = String(req.headers.authorization || '');
    if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
    const cookies = parseCookies(req);
    if (cookies.crm_auth) return cookies.crm_auth;
    return '';
}

function requireAdmin(req, res) {
    const expected = String(process.env.CRM_ADMIN_PASSWORD || '');
    if (!expected) {
        res.status(503).json({ ok: false, error: 'CRM_ADMIN_PASSWORD is not configured on the server.' });
        return false;
    }
    const got = extractAdminPassword(req);
    if (!got || got !== expected) {
        res.status(401).json({ ok: false, error: 'Unauthorized. Provide the CRM admin password.' });
        return false;
    }
    return true;
}

function adminCookieHeader(password) {
    // Session cookie for /crm convenience; HttpOnly so JS XSS cannot read it.
    // Secure on HTTPS (Vercel). SameSite=Strict.
    const maxAge = 60 * 60 * 12; // 12h
    return `crm_auth=${encodeURIComponent(password)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict; Secure`;
}

module.exports = {
    HEADER_ROW,
    STATUS_VALUES,
    isConfigured,
    hasServiceAccount,
    hasWebhook,
    appendLead,
    listLeads,
    updateLead,
    checkOrigin,
    requireAdmin,
    extractAdminPassword,
    adminCookieHeader,
    normalizeLeadInput
};
