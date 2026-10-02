(function () {
    const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];
    let currentFilter = '';
    let leadsCache = [];
    let passwordHeader = '';

    const loginView = document.getElementById('loginView');
    const appView = document.getElementById('appView');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');
    const leadsBody = document.getElementById('leadsBody');
    const leadCount = document.getElementById('leadCount');
    const crmBanner = document.getElementById('crmBanner');

    function showBanner(msg) {
        if (!msg) {
            crmBanner.classList.add('hidden');
            crmBanner.textContent = '';
            return;
        }
        crmBanner.textContent = msg;
        crmBanner.classList.remove('hidden');
    }

    function apiHeaders(extra) {
        const h = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
        if (passwordHeader) h['X-CRM-Password'] = passwordHeader;
        return h;
    }

    async function api(path, options) {
        const opts = Object.assign({ credentials: 'same-origin' }, options || {});
        opts.headers = apiHeaders(opts.headers);
        const res = await fetch(path, opts);
        let data = null;
        try { data = await res.json(); } catch (e) { data = null; }
        if (!res.ok) {
            const err = new Error((data && data.error) || ('Request failed (' + res.status + ')'));
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    function formatWhen(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    function esc(s) {
        return String(s == null ? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function peso(n) {
        const num = Number(n);
        if (!Number.isFinite(num) || num === 0) return n ? esc(n) : '—';
        return '₱' + num.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }

    function filteredLeads() {
        if (!currentFilter) return leadsCache;
        return leadsCache.filter((l) => String(l.status || '').toLowerCase() === currentFilter);
    }

    function renderTable() {
        const rows = filteredLeads();
        leadCount.textContent = rows.length + ' lead' + (rows.length === 1 ? '' : 's');

        if (!rows.length) {
            leadsBody.innerHTML = '<tr class="empty-row"><td colspan="6">No leads for this filter.</td></tr>';
            return;
        }

        leadsBody.innerHTML = rows.map((lead) => {
            const status = String(lead.status || 'new').toLowerCase();
            const statusOpts = STATUSES.map((s) =>
                '<option value="' + s + '"' + (s === status ? ' selected' : '') + '>' + s + '</option>'
            ).join('');
            const tel = lead.phone ? ('tel:' + String(lead.phone).replace(/\s+/g, '')) : '';
            const mail = lead.email ? ('mailto:' + lead.email) : '';
            const cap = lead.systemCapacity ? (Number(lead.systemCapacity).toFixed(2) + ' kWp') : '—';
            const payback = lead.paybackYears
                ? (Number(lead.paybackYears).toFixed(1) + ' yrs')
                : '—';

            return (
                '<tr data-id="' + esc(lead.id) + '">' +
                '<td><div>' + esc(formatWhen(lead.createdAt)) + '</div>' +
                '<div class="muted">' + esc(lead.id) + '</div></td>' +
                '<td>' +
                '<div class="contact-name">' + esc(lead.name || '—') + '</div>' +
                '<div class="contact-line">' +
                (mail ? '<a href="' + esc(mail) + '">' + esc(lead.email) + '</a>' : esc(lead.email || '—')) +
                '</div>' +
                '<div class="contact-line">' +
                (tel ? '<a href="' + esc(tel) + '">' + esc(lead.phone) + '</a>' : esc(lead.phone || '')) +
                '</div>' +
                '<div class="muted">' + esc(lead.location || '') + '</div>' +
                '</td>' +
                '<td>' +
                '<div class="qual-line">' + esc(lead.timeframe || '—') + '</div>' +
                '<div class="qual-line">' + esc(lead.budget || '—') + '</div>' +
                '<div class="muted">' + esc(lead.channel || '') + '</div>' +
                '</td>' +
                '<td>' +
                '<div class="sys-line"><strong>' + esc(cap) + '</strong> · ' + esc(lead.systemType || '—') + '</div>' +
                '<div class="sys-line">' + esc(lead.projectScale || '') + '</div>' +
                '<div class="muted">Bill ' + peso(lead.monthlyBill) +
                ' · Save ' + peso(lead.monthlySavings) +
                ' · PB ' + esc(payback) + '</div>' +
                '<div class="muted">Cost ' + esc(lead.systemCost || '—') + '</div>' +
                '</td>' +
                '<td>' +
                '<span class="status-pill status-' + esc(status) + '">' + esc(status) + '</span>' +
                '<select class="status-select" data-field="status" aria-label="Status">' + statusOpts + '</select>' +
                '</td>' +
                '<td>' +
                '<textarea class="notes-input" data-field="notes" rows="2" aria-label="Notes">' +
                esc(lead.notes || '') + '</textarea>' +
                '<button type="button" class="btn-save" data-action="save">Save</button>' +
                '<span class="save-msg hidden" data-msg></span>' +
                '</td>' +
                '</tr>'
            );
        }).join('');
    }

    async function loadLeads() {
        showBanner('');
        leadsBody.innerHTML = '<tr class="empty-row"><td colspan="6">Loading…</td></tr>';
        try {
            const data = await api('/api/leads');
            leadsCache = Array.isArray(data.leads) ? data.leads : [];
            renderTable();
        } catch (err) {
            if (err.status === 401) {
                showApp(false);
                loginError.textContent = 'Session expired. Sign in again.';
                loginError.classList.remove('hidden');
                return;
            }
            leadsBody.innerHTML = '<tr class="empty-row"><td colspan="6">Could not load leads.</td></tr>';
            showBanner(err.message || 'Could not load leads.');
        }
    }

    function showApp(on) {
        if (on) {
            loginView.classList.add('hidden');
            appView.classList.remove('hidden');
        } else {
            appView.classList.add('hidden');
            loginView.classList.remove('hidden');
            passwordHeader = '';
            try { sessionStorage.removeItem('crm_pw'); } catch (e) { /* ignore */ }
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden');
        const password = document.getElementById('crmPassword').value;
        loginBtn.disabled = true;
        try {
            passwordHeader = password;
            await api('/api/leads', {
                method: 'POST',
                body: JSON.stringify({ action: 'login', password })
            });
            try { sessionStorage.setItem('crm_pw', password); } catch (err) { /* ignore */ }
            showApp(true);
            await loadLeads();
        } catch (err) {
            passwordHeader = '';
            loginError.textContent = err.message || 'Login failed.';
            loginError.classList.remove('hidden');
        } finally {
            loginBtn.disabled = false;
        }
    });

    document.getElementById('btnLogout').addEventListener('click', async () => {
        try {
            await api('/api/leads', {
                method: 'POST',
                body: JSON.stringify({ action: 'logout' })
            });
        } catch (e) { /* ignore */ }
        showApp(false);
        document.getElementById('crmPassword').value = '';
    });

    document.getElementById('btnRefresh').addEventListener('click', () => loadLeads());

    document.querySelectorAll('.filter-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-status') || '';
            renderTable();
        });
    });

    leadsBody.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action="save"]');
        if (!btn) return;
        const tr = btn.closest('tr');
        if (!tr) return;
        const id = tr.getAttribute('data-id');
        const status = (tr.querySelector('[data-field="status"]') || {}).value;
        const notes = (tr.querySelector('[data-field="notes"]') || {}).value;
        const msg = tr.querySelector('[data-msg]');
        btn.disabled = true;
        if (msg) {
            msg.classList.add('hidden');
            msg.classList.remove('error');
        }
        try {
            const data = await api('/api/leads', {
                method: 'PATCH',
                body: JSON.stringify({ id, status, notes })
            });
            const updated = data.lead;
            const idx = leadsCache.findIndex((l) => l.id === id);
            if (idx >= 0 && updated) leadsCache[idx] = Object.assign({}, leadsCache[idx], updated);
            if (msg) {
                msg.textContent = 'Saved';
                msg.classList.remove('hidden');
            }
            // Re-render so pill + filter stay in sync
            renderTable();
        } catch (err) {
            if (msg) {
                msg.textContent = err.message || 'Save failed';
                msg.classList.add('error');
                msg.classList.remove('hidden');
            }
        } finally {
            btn.disabled = false;
        }
    });

    // Restore session if cookie/password still valid
    (async function boot() {
        try {
            passwordHeader = sessionStorage.getItem('crm_pw') || '';
        } catch (e) {
            passwordHeader = '';
        }
        try {
            await api('/api/leads');
            showApp(true);
            await loadLeads();
        } catch (err) {
            showApp(false);
        }
    })();
})();
