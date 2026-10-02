// /api/leads — CRM admin API (password-protected).
// GET  — list leads
// PATCH — update status and/or notes ({ id, status?, notes? })
// POST  — { action: 'login', password } sets HttpOnly crm_auth cookie
// POST  — { action: 'logout' } clears cookie

const {
    listLeads,
    updateLead,
    checkOrigin,
    requireAdmin,
    hasServiceAccount,
    adminCookieHeader,
    STATUS_VALUES
} = require('./_sheets');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (!checkOrigin(req)) {
        res.status(403).json({ ok: false, error: 'Forbidden.' });
        return;
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
    }

    // Login / logout do not require prior auth
    if (req.method === 'POST' && body && body.action === 'login') {
        const expected = String(process.env.CRM_ADMIN_PASSWORD || '');
        if (!expected) {
            res.status(503).json({ ok: false, error: 'CRM_ADMIN_PASSWORD is not configured.' });
            return;
        }
        const password = String(body.password || '');
        if (password !== expected) {
            res.status(401).json({ ok: false, error: 'Wrong password.' });
            return;
        }
        res.setHeader('Set-Cookie', adminCookieHeader(password));
        res.status(200).json({
            ok: true,
            statuses: STATUS_VALUES,
            sheetsReady: hasServiceAccount()
        });
        return;
    }

    if (req.method === 'POST' && body && body.action === 'logout') {
        res.setHeader('Set-Cookie', 'crm_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure');
        res.status(200).json({ ok: true });
        return;
    }

    if (!requireAdmin(req, res)) return;

    if (req.method === 'GET') {
        try {
            const leads = await listLeads();
            const statusFilter = String(req.query && req.query.status || '').toLowerCase();
            const filtered = statusFilter && STATUS_VALUES.includes(statusFilter)
                ? leads.filter((l) => String(l.status).toLowerCase() === statusFilter)
                : leads;
            res.status(200).json({ ok: true, leads: filtered, statuses: STATUS_VALUES });
        } catch (err) {
            const status = err && err.status ? err.status : 502;
            console.error('leads list failed', err && err.message);
            res.status(status).json({ ok: false, error: (err && err.message) || 'Could not load leads.' });
        }
        return;
    }

    if (req.method === 'PATCH') {
        if (!body || typeof body !== 'object') {
            res.status(400).json({ ok: false, error: 'Expected JSON body with id.' });
            return;
        }
        try {
            const lead = await updateLead(body.id, {
                status: body.status,
                notes: body.notes
            });
            res.status(200).json({ ok: true, lead });
        } catch (err) {
            const status = err && err.status ? err.status : 502;
            console.error('leads patch failed', err && err.message);
            res.status(status).json({ ok: false, error: (err && err.message) || 'Could not update lead.' });
        }
        return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed. Use GET, PATCH, or POST (login/logout).' });
};
