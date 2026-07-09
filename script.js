document.addEventListener('DOMContentLoaded', () => {
    // ==================== EMAILJS CONFIGURATION ====================
    const EMAILJS_CONFIG = {
        publicKey: '4b7a3sQV-LmDcToos',
        serviceId: 'service_sx1yj4d',
        customerTemplateId: 'template_4ogepjc',
        // Sales notifications reuse the same working template, but addressed to notifyEmail
        // (the Kinmo inbox) with reply_to set to the customer — so no extra EmailJS template
        // is needed. To route leads to a different inbox, just change notifyEmail below.
        notifyTemplateId: 'template_4ogepjc',
        notifyEmail: 'earldy.kpwunibest@gmail.com'
    };

    // Initialize EmailJS
    if (window.emailjs && EMAILJS_CONFIG.publicKey !== 'YOUR_PUBLIC_KEY') {
        emailjs.init(EMAILJS_CONFIG.publicKey);
    }

    // ==================== CONSTANTS ====================
    const REGION_PSH = {
        metro_manila: 4.3,
        northern_luzon: 4.5,
        cordillera: 3.8,
        central_luzon: 4.4,
        southern_luzon: 4.5,
        visayas: 4.5,
        mindanao: 4.5
    };
    const REGION_LABELS = {
        metro_manila: 'Metro Manila',
        northern_luzon: 'Northern Luzon',
        cordillera: 'Baguio / Cordillera',
        central_luzon: 'Central Luzon',
        southern_luzon: 'Southern Luzon',
        visayas: 'Visayas',
        mindanao: 'Mindanao'
    };
    const DEFAULT_PSH = 4.3;
    const EFFICIENCY = 0.80;
    const PANEL_SIZE_SQM = 3.0;
    const SYSTEM_LIFESPAN_YEARS = 25;
    const DAYS_PER_MONTH = 30;
    const OFFGRID_DESIGN_FACTOR = 1.25;
    const BATTERY_DOD = 0.9;
    const PANEL_ROUND_MULTIPLE = 2;
    const DEBOUNCE_MS = 150;
    // Financial realism constants
    const PANEL_DEGRADATION_RATE = 0.004; // 0.4%/yr (premium Tier 1: Canadian Solar, Trina, Jinko)
    const ELECTRICITY_RATE_INFLATION = 0.045; // 4.5%/yr (Meralco historical CAGR)
    const INVERTER_REPLACEMENT_YEAR = 12;
    const INVERTER_REPLACEMENT_COST_PCT = 0.10; // 10% of solar cost

    // ==================== UTILITIES ====================
    function debounce(fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    const activeAnimations = new Map();

    function animateValue(element, start, end, duration = 800, suffix = '') {
        if (!element) return;

        if (activeAnimations.has(element)) {
            cancelAnimationFrame(activeAnimations.get(element));
        }

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            element.textContent = end.toFixed(end < 10 ? 2 : 1) + suffix;
            return;
        }

        element.classList.add('updating');
        const range = end - start;
        const startTime = performance.now();

        function step(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            const current = start + (range * easeProgress);

            element.textContent = current.toFixed(current < 10 ? 2 : 1) + suffix;

            if (progress < 1) {
                const frameId = requestAnimationFrame(step);
                activeAnimations.set(element, frameId);
            } else {
                element.textContent = end.toFixed(end < 10 ? 2 : 1) + suffix;
                activeAnimations.delete(element);
                setTimeout(() => element.classList.remove('updating'), 300);
            }
        }

        const frameId = requestAnimationFrame(step);
        activeAnimations.set(element, frameId);
    }

    function formatPHP(val) {
        return '₱ ' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatPHPShort(val) {
        if (val >= 1000000) {
            return '₱' + (val / 1000000).toFixed(2) + 'M';
        } else if (val >= 1000) {
            return '₱' + (val / 1000).toFixed(0) + 'K';
        }
        return '₱' + val.toFixed(0);
    }

    // Rounds to a clean band (low rounded down, high rounded up) so the figure
    // reads as a rough estimate, not a quote. Compact shared-suffix form keeps it
    // on one line: "₱300–420K", "₱1.55–1.85M", "₱12.90–16.25M".
    function formatPHPRange(low, high) {
        low = Number(low) || 0; high = Number(high) || 0;
        const step = high < 1000000 ? 20000 : 50000;
        const lo = Math.floor(low / step) * step;
        let hi = Math.ceil(high / step) * step;
        if (hi <= lo) hi = lo + step;
        if (lo >= 1e6 && hi >= 1e6) return '₱' + (lo / 1e6).toFixed(2) + '–' + (hi / 1e6).toFixed(2) + 'M';
        if (hi < 1e6) return '₱' + (lo / 1e3).toFixed(0) + '–' + (hi / 1e3).toFixed(0) + 'K';
        return formatPHPShort(lo) + ' – ' + formatPHPShort(hi);
    }

    function clampInput(el) {
        const val = parseFloat(el.value);
        const min = parseFloat(el.min);
        const max = parseFloat(el.max);
        if (!isNaN(min) && val < min) el.value = min;
        if (!isNaN(max) && val > max) el.value = max;
    }

    // ==================== SAVINGS CHART CLASS ====================
    class SavingsChart {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.data = null;
            this.animationProgress = 1;
            this.animationFrame = null;

            this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            this.motionQuery.addEventListener('change', (e) => {
                this.reducedMotion = e.matches;
            });

            this.resizeObserver = new ResizeObserver(() => this.handleResize());
            this.resizeObserver.observe(this.canvas.parentElement);
        }

        handleResize() {
            const container = this.canvas.parentElement;
            const dpr = window.devicePixelRatio || 1;
            const rect = container.getBoundingClientRect();
            const h = Math.min(rect.width * 0.5, 400);
            this.canvas.width = rect.width * dpr;
            this.canvas.height = h * dpr;
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = h + 'px';
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (this.data) this.draw();
        }

        update(results) {
            const source = Array.isArray(results.yearlyCumulative) && results.yearlyCumulative.length
                ? results.yearlyCumulative
                : Array.from({ length: SYSTEM_LIFESPAN_YEARS + 1 }, (_, y) => ({ year: y, cumulative: (results.annualSavings || 0) * y }));
            const years = source.map(pt => ({
                year: pt.year,
                cumulativeSavings: pt.cumulative,
                systemCost: results.estimatedSystemCost
            }));
            this.data = {
                years,
                paybackYear: results.paybackYears,
                systemCost: results.estimatedSystemCost,
                annualSavings: results.annualSavings
            };

            if (this.reducedMotion) {
                this.animationProgress = 1;
                this.handleResize();
            } else {
                this.animateIn();
            }
        }

        animateIn() {
            this.animationProgress = 0;
            const duration = 800;
            const start = performance.now();
            const step = (now) => {
                const elapsed = now - start;
                this.animationProgress = Math.min(elapsed / duration, 1);
                this.handleResize();
                if (this.animationProgress < 1) {
                    this.animationFrame = requestAnimationFrame(step);
                }
            };
            if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
            this.animationFrame = requestAnimationFrame(step);
        }

        draw() {
            const ctx = this.ctx;
            const w = this.canvas.width / (window.devicePixelRatio || 1);
            const h = this.canvas.height / (window.devicePixelRatio || 1);

            const styles = getComputedStyle(document.documentElement);
            const colorPrimary = styles.getPropertyValue('--primary').trim() || '#3b82f6';
            const colorSuccess = styles.getPropertyValue('--success').trim() || '#10b981';
            const colorDanger = styles.getPropertyValue('--danger').trim() || '#ef4444';
            const colorAccent = styles.getPropertyValue('--accent').trim() || '#f59e0b';
            const colorMuted = styles.getPropertyValue('--text-muted').trim() || '#94a3b8';

            ctx.clearRect(0, 0, w, h);

            if (!this.data || this.data.systemCost <= 0) {
                ctx.fillStyle = colorMuted;
                ctx.font = '500 14px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Enter values to see savings projection', w / 2, h / 2);
                return;
            }

            const pad = { left: 75, right: 25, top: 30, bottom: 45 };
            const chartW = w - pad.left - pad.right;
            const chartH = h - pad.top - pad.bottom;

            const maxSavings = this.data.years[this.data.years.length - 1].cumulativeSavings;
            const yMax = Math.max(this.data.systemCost, maxSavings) * 1.15;
            const xMax = SYSTEM_LIFESPAN_YEARS;

            const toX = (year) => pad.left + (year / xMax) * chartW;
            const toY = (val) => pad.top + chartH - (val / yMax) * chartH;

            // Gridlines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = 1;
            const gridSteps = 5;
            for (let i = 0; i <= gridSteps; i++) {
                const val = (yMax / gridSteps) * i;
                const y = toY(val);
                ctx.beginPath();
                ctx.moveTo(pad.left, y);
                ctx.lineTo(w - pad.right, y);
                ctx.stroke();

                ctx.fillStyle = colorMuted;
                ctx.font = '600 10px Inter, sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(formatPHPShort(val), pad.left - 10, y + 4);
            }

            // X-axis labels
            ctx.textAlign = 'center';
            ctx.font = '600 10px Inter, sans-serif';
            for (let yr = 0; yr <= xMax; yr += 5) {
                const x = toX(yr);
                ctx.fillStyle = colorMuted;
                ctx.fillText('Yr ' + yr, x, h - pad.bottom + 20);

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
                ctx.beginPath();
                ctx.moveTo(x, pad.top);
                ctx.lineTo(x, pad.top + chartH);
                ctx.stroke();
            }

            // Clip to animation progress
            ctx.save();
            ctx.beginPath();
            ctx.rect(pad.left, 0, chartW * this.animationProgress, h);
            ctx.clip();

            // System cost line (dashed)
            const costY = toY(this.data.systemCost);
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = colorDanger;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(pad.left, costY);
            ctx.lineTo(w - pad.right, costY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Cost label
            ctx.fillStyle = colorDanger;
            ctx.font = '700 10px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('System Cost: ' + formatPHPShort(this.data.systemCost), pad.left + 5, costY - 8);

            // Savings area fill
            const gradient = ctx.createLinearGradient(pad.left, pad.top + chartH, pad.left, pad.top);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.02)');
            gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.12)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.2)');

            ctx.beginPath();
            ctx.moveTo(toX(0), toY(0));
            for (const pt of this.data.years) {
                ctx.lineTo(toX(pt.year), toY(pt.cumulativeSavings));
            }
            ctx.lineTo(toX(xMax), toY(0));
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();

            // Savings line
            const lineGrad = ctx.createLinearGradient(pad.left, 0, w - pad.right, 0);
            lineGrad.addColorStop(0, colorPrimary);
            lineGrad.addColorStop(1, colorSuccess);
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            for (let i = 0; i < this.data.years.length; i++) {
                const pt = this.data.years[i];
                const x = toX(pt.year);
                const y = toY(pt.cumulativeSavings);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Data points
            for (const pt of this.data.years) {
                const x = toX(pt.year);
                const y = toY(pt.cumulativeSavings);
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fillStyle = colorPrimary;
                ctx.fill();
            }

            // Break-even marker
            if (this.data.paybackYear > 0 && this.data.paybackYear <= xMax) {
                const bx = toX(this.data.paybackYear);
                const by = toY(this.data.systemCost);

                ctx.setLineDash([4, 3]);
                ctx.strokeStyle = colorAccent;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(bx, pad.top);
                ctx.lineTo(bx, pad.top + chartH);
                ctx.stroke();
                ctx.setLineDash([]);

                // Marker circle
                ctx.beginPath();
                ctx.arc(bx, by, 7, 0, Math.PI * 2);
                ctx.fillStyle = colorAccent;
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Label
                ctx.fillStyle = colorAccent;
                ctx.font = '700 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Break-even', bx, pad.top - 5);
                ctx.font = '600 10px Inter, sans-serif';
                ctx.fillText('Year ' + this.data.paybackYear.toFixed(1), bx, pad.top + 10);
            }

            ctx.restore();
        }
    }

    // ==================== DOM ELEMENTS ====================
    const elements = {
        projectScale: document.getElementById('projectScale'),
        systemType: document.getElementById('systemType'),
        bill: document.getElementById('bill'),
        rate: document.getElementById('rate'),
        region: document.getElementById('region'),
        breakdownContent: document.getElementById('breakdownContent'),
        breakdownHeadline: document.getElementById('breakdownHeadline'),
        solarTarget: document.getElementById('solarTarget'),
        solarTargetVal: document.getElementById('solarTargetVal'),
        roofType: document.getElementById('roofType'),
        area: document.getElementById('area'),
        recommendedArea: document.getElementById('recommendedArea'),
        wattage: document.getElementById('wattage'),
        daytimeLoad: document.getElementById('daytimeLoad'),
        daytimeLoadVal: document.getElementById('daytimeLoadVal'),
        daytimeLoadGroup: document.getElementById('daytimeLoadGroup'),
        shiftGroup: document.getElementById('shiftGroup'),
        batterySection: document.getElementById('batterySection'),
        backupHours: document.getElementById('backupHours'),
        backupHoursVal: document.getElementById('backupHoursVal'),
        batteryUnit: document.getElementById('batteryUnit'),
        enableNetMetering: document.getElementById('enableNetMetering'),
        genCharge: document.getElementById('genCharge'),
        genChargeGroup: document.getElementById('genChargeGroup'),
        displayProjectScale: document.getElementById('displayProjectScale'),
        resCapacity: document.getElementById('resCapacity'),
        resPanels: document.getElementById('resPanels'),
        resArea: document.getElementById('resArea'),
        resStorage: document.getElementById('resStorage'),
        resStorageCard: document.getElementById('resStorageCard'),
        resSystemCost: document.getElementById('resSystemCost'),
        resPayback: document.getElementById('resPayback'),
        resROI: document.getElementById('resROI'),
        sc1Monthly: document.getElementById('sc1Monthly'),
        sc1Offset: document.getElementById('sc1Offset'),
        sc1Yearly: document.getElementById('sc1Yearly'),
        sc1Title: document.getElementById('sc1Title'),
        sc1Desc: document.getElementById('sc1Desc'),
        sc2Active: document.getElementById('sc2Active'),
        sc2Disabled: document.getElementById('sc2Disabled'),
        sc2OffGrid: document.getElementById('sc2OffGrid'),
        sc2Monthly: document.getElementById('sc2Monthly'),
        sc2Offset: document.getElementById('sc2Offset'),
        sc2Yearly: document.getElementById('sc2Yearly'),
        detMonthlyGen: document.getElementById('detMonthlyGen'),
        detDirectCons: document.getElementById('detDirectCons'),
        detSurplus: document.getElementById('detSurplus'),
        detSurplusRow: document.getElementById('detSurplusRow'),
        detMonthlyReq: document.getElementById('detMonthlyReq'),
        detConfigTitle: document.getElementById('detConfigTitle'),
        detConfigContent: document.getElementById('detConfigContent'),
        statusAlerts: document.getElementById('statusAlerts'),
        offGridInfo: document.getElementById('offGridInfo'),
        btnReset: document.getElementById('btnReset')
    };

    const shiftOptions = document.querySelectorAll('.shift-option');
    const clearButtons = document.querySelectorAll('.clear-input');

    let currentShift = 1;
    let lastSubmitTime = 0;

    const batteryOptionsMap = {
        'Residential': { '5kWh': 5, '10kWh': 10, '15kWh': 15 },
        'C&I': { '100kWh': 100, '215kWh': 215, '1MWh': 1000 },
        'Utility Scale': { '215kWh': 215, '1MWh': 1000 }
    };

    const DEFAULTS = {
        projectScale: 'Residential',
        systemType: 'Grid-Tied',
        bill: '8000',
        rate: '12',
        solarTarget: '100',
        area: '50',
        wattage: '620',
        daytimeLoad: '40',
        backupHours: '4',
        enableNetMetering: false,
        genCharge: '5.5'
    };

    // Daytime-load handling: Residential uses a fixed hidden default; C&I / Utility
    // derive the daytime split from the selected operating shift (which sets the slider).
    const SHIFT_DAYTIME_MAP = { 1: 85, 2: 55, 3: 40 };
    const RESIDENTIAL_DAYTIME_DEFAULT = 40;

    function setDaytimeSlider(v) {
        if (!elements.daytimeLoad) return;
        v = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
        elements.daytimeLoad.value = v;
        elements.daytimeLoad.setAttribute('aria-valuenow', v);
        if (elements.daytimeLoadVal) elements.daytimeLoadVal.value = v;
        if (typeof updateRangeBackground === 'function') updateRangeBackground(elements.daytimeLoad);
    }

    function setDaytimeFromShift(shift) {
        setDaytimeSlider(SHIFT_DAYTIME_MAP[shift] || 55);
    }

    // Show/hide daytime-split + operating-shift inputs based on project scale,
    // and keep the effective daytime value in sync.
    function applyScaleVisibility(scale) {
        if (scale === 'Residential') {
            elements.daytimeLoadGroup.classList.add('hidden');
            elements.shiftGroup.classList.add('hidden');
            setDaytimeSlider(RESIDENTIAL_DAYTIME_DEFAULT);
        } else {
            elements.daytimeLoadGroup.classList.remove('hidden');
            elements.shiftGroup.classList.remove('hidden');
            setDaytimeFromShift(currentShift);
        }
    }

    // ==================== COST CALCULATION ====================
    // Public-facing per-kWp price BAND (PHP). Low = competitive pricing for a
    // straightforward install; High = site complexity (roof type, structural or
    // electrical upgrades, longer cabling runs, permitting). Battery priced separately.
    function getCostRangePerKwp(scale, capacityKwp) {
        if (scale === 'Utility Scale') return { low: 29500, high: 33500 };
        if (capacityKwp <= 20)  return { low: 42000, high: 54000 };
        if (capacityKwp <= 50)  return { low: 37000, high: 42000 };
        if (capacityKwp <= 100) return { low: 34500, high: 38000 };
        if (capacityKwp <= 300) return { low: 32500, high: 37000 };
        return { low: 29500, high: 33500 };
    }

    // Midpoint of the band — the single representative figure that drives
    // payback / ROI / financing / chart math (which need one number, not a range).
    function getCostPerKwp(scale, capacityKwp) {
        const r = getCostRangePerKwp(scale, capacityKwp);
        return (r.low + r.high) / 2;
    }

    function getBatteryCostPerKwh(scale) {
        // Flat ₱11,000/kWh across all scales (simplified pricing)
        return 11000;
    }

    function getOMRatePerYear(scale) {
        // Annual operations & maintenance as fraction of contract price (1.5–2.0%/yr):
        // cleaning, monitoring, minor part replacement, and periodic inspection.
        if (scale === 'Residential') return 0.015; // 1.5%/yr
        if (scale === 'C&I') return 0.0175; // 1.75%/yr
        return 0.02; // Utility Scale 2.0%/yr
    }

    // ==================== BATTERY LOGIC ====================
    function findOptimalBattery(requiredKwh, scale) {
        const options = batteryOptionsMap[scale];
        if (!options || requiredKwh <= 0) {
            return { unitKwh: 0, numUnits: 0, totalKwh: 0, label: '' };
        }

        let bestOption = null;
        let smallestTotal = Infinity;

        for (const [label, unitKwh] of Object.entries(options)) {
            const numUnits = Math.ceil(requiredKwh / unitKwh);
            const totalKwh = numUnits * unitKwh;

            if (totalKwh < smallestTotal) {
                smallestTotal = totalKwh;
                bestOption = { unitKwh, numUnits, totalKwh, label };
            } else if (totalKwh === smallestTotal && bestOption && numUnits < bestOption.numUnits) {
                bestOption = { unitKwh, numUnits, totalKwh, label };
            }
        }

        return bestOption || { unitKwh: 0, numUnits: 0, totalKwh: 0, label: '' };
    }

    function updateBatteryOptions() {
        const scale = elements.projectScale.value;
        const options = batteryOptionsMap[scale] || {};
        elements.batteryUnit.innerHTML = '';
        Object.entries(options).forEach(([label]) => {
            const opt = document.createElement('option');
            opt.value = label;
            opt.textContent = label;
            elements.batteryUnit.appendChild(opt);
        });
        elements.batteryUnit.selectedIndex = elements.batteryUnit.options.length - 1;
    }

    // ==================== PURE COMPUTATION FUNCTION ====================
    function computeSolar(params) {
        const { scale, type, bill, rate, solarTargetPct, area, wattage, daytimeLoadPct, backupHours, enableNetMetering, genChargeRate, region } = params;
        const psh = REGION_PSH[region] || DEFAULT_PSH;

        const monthlyKwh = rate > 0 ? bill / rate : 0;
        const dailyKwh = monthlyKwh / DAYS_PER_MONTH;
        const targetDailySolarKwh = dailyKwh * (solarTargetPct / 100);

        const designFactor = type === 'Off-Grid' ? OFFGRID_DESIGN_FACTOR : 1.0;
        const requiredKwp = (psh * EFFICIENCY > 0) ? (targetDailySolarKwh / (psh * EFFICIENCY)) * designFactor : 0;

        let numPanelsRequired = Math.ceil((requiredKwp * 1000) / wattage) || 0;
        numPanelsRequired = Math.ceil(numPanelsRequired / PANEL_ROUND_MULTIPLE) * PANEL_ROUND_MULTIPLE;

        const totalPanelsPossible = Math.floor(area / PANEL_SIZE_SQM) || 0;
        const cappedPanelsPossible = Math.floor(totalPanelsPossible / PANEL_ROUND_MULTIPLE) * PANEL_ROUND_MULTIPLE;

        const displayPanels = Math.min(numPanelsRequired, cappedPanelsPossible);
        const displayKwp = (displayPanels * wattage) / 1000;
        const displayArea = displayPanels * PANEL_SIZE_SQM;

        const effectiveDailySolarKwh = displayKwp * psh * EFFICIENCY;
        const daytimeLoadKwh = dailyKwh * (daytimeLoadPct / 100);
        const nighttimeLoadKwh = dailyKwh - daytimeLoadKwh;

        const directConsumedKwh = Math.min(effectiveDailySolarKwh, daytimeLoadKwh);
        const surplusSolarKwh = Math.max(0, effectiveDailySolarKwh - daytimeLoadKwh);

        // Backup is sized off the heavier evening/night load (concentrated over ~6h), not the
        // 24h average, and grossed up by depth-of-discharge so usable capacity meets the need.
        const EVENING_HOURS = 6;
        const eveningHourlyLoad = EVENING_HOURS > 0 ? nighttimeLoadKwh / EVENING_HOURS : 0;
        const backupStorageNeeded = eveningHourlyLoad * backupHours;

        let optimalBattery;
        if (type === 'Off-Grid') {
            // Off-grid must carry the full nighttime load until the sun returns.
            optimalBattery = findOptimalBattery(nighttimeLoadKwh / BATTERY_DOD, scale);
        } else if (type === 'Hybrid') {
            optimalBattery = findOptimalBattery(backupStorageNeeded / BATTERY_DOD, scale);
        } else {
            optimalBattery = findOptimalBattery(surplusSolarKwh, scale);
        }

        const numBatt = optimalBattery.numUnits;
        const batteryCapacityTotal = optimalBattery.totalKwh;
        const batteryUnitLabel = optimalBattery.label;
        const usableBatteryKwh = batteryCapacityTotal * BATTERY_DOD;
        const batteryShiftedKwh = Math.min(surplusSolarKwh, usableBatteryKwh, nighttimeLoadKwh);

        let c1Title = "", c1Desc = "", c1DailySavingsKwh = 0, residualSurplusKwh = 0;
        if (type === 'Grid-Tied') {
            c1Title = "1. Grid-Tied (Direct)";
            c1Desc = "Direct self-consumption based on " + daytimeLoadPct + "% daytime usage";
            c1DailySavingsKwh = directConsumedKwh;
            residualSurplusKwh = surplusSolarKwh;
        } else if (type === 'Hybrid') {
            c1Title = "1. Hybrid (PV + Battery)";
            c1Desc = "Direct consumption + " + backupHours + "h battery backup";
            c1DailySavingsKwh = directConsumedKwh + batteryShiftedKwh;
            residualSurplusKwh = Math.max(0, surplusSolarKwh - usableBatteryKwh);
        } else {
            c1Title = "1. Off-Grid (PV + Battery)";
            c1Desc = "Full 24h coverage (" + backupHours + "h storage config)";
            c1DailySavingsKwh = directConsumedKwh + batteryShiftedKwh;
            residualSurplusKwh = 0;
        }

        const c1MonthlySavings = Math.min(c1DailySavingsKwh * DAYS_PER_MONTH * rate, bill);
        const c1Offset = dailyKwh > 0 ? (c1DailySavingsKwh / dailyKwh * 100) : 0;

        let c2MonthlySavings = 0, c2Offset = 0;
        if (type !== 'Off-Grid' && enableNetMetering) {
            const c2GrossMonthly = (c1DailySavingsKwh * DAYS_PER_MONTH * rate) + (residualSurplusKwh * DAYS_PER_MONTH * genChargeRate);
            c2MonthlySavings = Math.min(c2GrossMonthly, bill);
            c2Offset = dailyKwh > 0 ? (effectiveDailySolarKwh / dailyKwh * 100) : 0;
        }

        // The headline economics (payback, ROI, 25-yr chart, comparison, financing, PDF) follow
        // the ACTUAL configuration: net-metered savings when net metering is on, else direct
        // self-consumption. This keeps every decision surface consistent with each other.
        const effectiveMonthlySavings = (type !== 'Off-Grid' && enableNetMetering) ? c2MonthlySavings : c1MonthlySavings;
        const effectiveOffset = (type !== 'Off-Grid' && enableNetMetering) ? c2Offset : c1Offset;

        const costPerKwp = getCostPerKwp(scale, displayKwp);
        const solarCost = displayKwp * costPerKwp;
        const batteryCost = (type !== 'Grid-Tied' && batteryCapacityTotal > 0)
            ? batteryCapacityTotal * getBatteryCostPerKwh(scale) : 0;
        const estimatedSystemCost = solarCost + batteryCost;
        // Public-facing cost BAND: vary the solar per-kWp rate across its tier;
        // battery cost is fixed and added identically to both bounds.
        const costRange = getCostRangePerKwp(scale, displayKwp);
        const estimatedSystemCostLow = displayKwp * costRange.low + batteryCost;
        const estimatedSystemCostHigh = displayKwp * costRange.high + batteryCost;
        const annualSavings = effectiveMonthlySavings * 12;

        // Realistic lifetime model: panel degradation, rate inflation, O&M, inverter replacement
        const annualOM = estimatedSystemCost * getOMRatePerYear(scale);
        const inverterReplacementCost = solarCost * INVERTER_REPLACEMENT_COST_PCT;
        const yearlyCumulative = [{ year: 0, netAnnual: 0, cumulative: 0 }];
        let cumulativeNet = 0;
        let paybackYears = 0;
        for (let year = 1; year <= SYSTEM_LIFESPAN_YEARS; year++) {
            const degradationFactor = Math.pow(1 - PANEL_DEGRADATION_RATE, year - 1);
            const inflationFactor = Math.pow(1 + ELECTRICITY_RATE_INFLATION, year - 1);
            const grossSavings = annualSavings * degradationFactor * inflationFactor;
            let netAnnual = grossSavings - annualOM;
            if (year === INVERTER_REPLACEMENT_YEAR) netAnnual -= inverterReplacementCost;
            const prevCumulative = cumulativeNet;
            cumulativeNet += netAnnual;
            if (paybackYears === 0 && prevCumulative < estimatedSystemCost && cumulativeNet >= estimatedSystemCost && netAnnual > 0) {
                paybackYears = (year - 1) + (estimatedSystemCost - prevCumulative) / netAnnual;
            }
            yearlyCumulative.push({ year, netAnnual, cumulative: cumulativeNet });
        }
        const totalLifetimeSavings = cumulativeNet;
        const roi = estimatedSystemCost > 0 ? ((totalLifetimeSavings - estimatedSystemCost) / estimatedSystemCost * 100) : 0;

        const isSpaceLimited = numPanelsRequired > cappedPanelsPossible;
        const batteryConfig = type !== 'Grid-Tied' ? numBatt + 'x ' + batteryUnitLabel + ' (' + batteryCapacityTotal.toFixed(1) + ' kWh)' : 'None';

        return {
            displayKwp, displayPanels, displayArea, monthlyKwh, dailyKwh,
            effectiveDailySolarKwh, directConsumedKwh, surplusSolarKwh,
            batteryCapacityTotal, numBatt, batteryUnitLabel, usableBatteryKwh, batteryShiftedKwh,
            c1Title, c1Desc, c1DailySavingsKwh, c1MonthlySavings, c1Offset, residualSurplusKwh,
            c2MonthlySavings, c2Offset, effectiveMonthlySavings, effectiveOffset,
            solarCost, batteryCost, estimatedSystemCost, estimatedSystemCostLow, estimatedSystemCostHigh, costPerKwp, paybackYears, roi, annualSavings, totalLifetimeSavings,
            yearlyCumulative, annualOM, inverterReplacementCost,
            batteryConfig, isSpaceLimited, numPanelsRequired, cappedPanelsPossible
        };
    }

    // ==================== MAIN CALCULATION (DOM WRAPPER) ====================
    function calculate() {
        const scale = elements.projectScale.value;
        const type = elements.systemType.value;
        const bill = Math.max(0, parseFloat(elements.bill.value) || 0);
        const rate = Math.max(0, parseFloat(elements.rate.value) || 0);
        const solarTargetPct = type === 'Off-Grid' ? 100 : parseInt(elements.solarTarget.value);
        const area = Math.max(0, parseFloat(elements.area.value) || 0);
        const wattage = Math.max(100, parseFloat(elements.wattage.value) || 620);

        // Daytime split is always read from the slider. For Residential it holds the
        // fixed hidden default; for C&I / Utility it is set by the operating-shift selector.
        const daytimeLoadPct = parseInt(elements.daytimeLoad.value);

        const backupHours = parseInt(elements.backupHours.value);
        const enableNetMetering = elements.enableNetMetering.checked;
        const genChargeRate = Math.max(0, parseFloat(elements.genCharge.value) || 0);
        const region = elements.region ? elements.region.value : 'metro_manila';

        // Build params for pure computation
        const params = { scale, type, bill, rate, solarTargetPct, area, wattage, daytimeLoadPct, backupHours, enableNetMetering, genChargeRate, region };
        const r = computeSolar(params);

        // Update visual labels
        elements.displayProjectScale.textContent = scale + " Project";
        elements.solarTargetVal.value = solarTargetPct;
        elements.daytimeLoadVal.value = daytimeLoadPct;
        elements.backupHoursVal.value = backupHours;

        // Animate metric values
        const prevCapacity = parseFloat(elements.resCapacity.textContent) || 0;
        const prevPanels = parseFloat(elements.resPanels.textContent) || 0;
        const prevArea = parseFloat(elements.resArea.textContent) || 0;

        animateValue(elements.resCapacity, prevCapacity, r.displayKwp, 800, " kWp");
        animateValue(elements.resPanels, prevPanels, r.displayPanels, 800, "");
        animateValue(elements.resArea, prevArea, r.displayArea, 800, " m²");

        // Battery storage card
        if (type === 'Grid-Tied') {
            elements.resStorageCard.classList.add('hidden');
        } else {
            elements.resStorageCard.classList.remove('hidden');
            const prevStorage = parseFloat(elements.resStorage.textContent) || 0;
            animateValue(elements.resStorage, prevStorage, r.batteryCapacityTotal, 800, " kWh");
        }

        // Scenario 1
        elements.sc1Title.textContent = r.c1Title;
        elements.sc1Desc.textContent = r.c1Desc;
        elements.sc1Monthly.textContent = formatPHP(r.c1MonthlySavings);
        elements.sc1Offset.textContent = Math.min(r.c1Offset, 100).toFixed(1) + "% Bill Offset";
        elements.sc1Yearly.textContent = "Est. " + formatPHP(r.c1MonthlySavings * 12).split('.')[0] + " / year";

        // Scenario 2
        if (type === 'Off-Grid') {
            elements.sc2Active.classList.add('hidden');
            elements.sc2Disabled.classList.add('hidden');
            elements.sc2OffGrid.classList.remove('hidden');
            elements.detSurplusRow.classList.add('hidden');
        } else if (!enableNetMetering) {
            elements.sc2Active.classList.add('hidden');
            elements.sc2Disabled.classList.remove('hidden');
            elements.sc2OffGrid.classList.add('hidden');
            elements.detSurplusRow.classList.remove('hidden');
        } else {
            elements.sc2Active.classList.remove('hidden');
            elements.sc2Disabled.classList.add('hidden');
            elements.sc2OffGrid.classList.add('hidden');
            elements.detSurplusRow.classList.remove('hidden');

            elements.sc2Monthly.textContent = formatPHP(r.c2MonthlySavings);
            elements.sc2Offset.textContent = Math.min(r.c2Offset, 100).toFixed(1) + "% Total Offset";
            elements.sc2Yearly.textContent = "Est. " + formatPHP(r.c2MonthlySavings * 12).split('.')[0] + " / year";
        }

        // ROI display
        if (elements.resSystemCost) elements.resSystemCost.textContent = formatPHPRange(r.estimatedSystemCostLow, r.estimatedSystemCostHigh);
        if (elements.resPayback) elements.resPayback.textContent = r.paybackYears > 0 ? r.paybackYears.toFixed(1) + " years" : "N/A";
        if (elements.resROI) elements.resROI.textContent = r.roi > 0 ? r.roi.toFixed(0) + "%" : "N/A";

        // Hide cost breakdown — show lump sum only
        const breakdownEl = document.getElementById('resCostBreakdown');
        if (breakdownEl) breakdownEl.classList.add('hidden');

        // 25-year lifetime breakdown headline (always visible on summary)
        if (elements.breakdownHeadline) {
            const netProfit = r.totalLifetimeSavings - r.estimatedSystemCost;
            elements.breakdownHeadline.textContent = netProfit > 0 ? '+' + formatPHPShort(netProfit) : formatPHPShort(netProfit);
            elements.breakdownHeadline.classList.toggle('positive', netProfit > 0);
            elements.breakdownHeadline.classList.toggle('negative', netProfit <= 0);
        }

        // 25-year lifetime breakdown
        if (elements.breakdownContent) {
            const grossLifetime = r.yearlyCumulative.reduce((sum, pt) => sum + (pt.netAnnual + r.annualOM + (pt.year === INVERTER_REPLACEMENT_YEAR ? r.inverterReplacementCost : 0)), 0);
            const totalOM = r.annualOM * SYSTEM_LIFESPAN_YEARS;
            const year1 = r.yearlyCumulative[1] || { netAnnual: 0 };
            const year25 = r.yearlyCumulative[SYSTEM_LIFESPAN_YEARS] || { netAnnual: 0 };
            const psh = REGION_PSH[region] || DEFAULT_PSH;
            elements.breakdownContent.innerHTML = `
                <div class="breakdown-row"><span>Region (PSH)</span><strong>${REGION_LABELS[region] || region} (${psh})</strong></div>
                <div class="breakdown-row"><span>Initial system cost</span><strong>${formatPHPShort(r.estimatedSystemCost)}</strong></div>
                <div class="breakdown-row"><span>Year-1 annual savings</span><strong class="positive">+${formatPHPShort(r.annualSavings)}</strong></div>
                <div class="breakdown-row"><span>Annual O&amp;M</span><strong class="planned">−${formatPHPShort(r.annualOM)}/yr</strong></div>
                <div class="breakdown-row"><span>Year-12 inverter replacement</span><strong class="planned">−${formatPHPShort(r.inverterReplacementCost)}</strong></div>
                <div class="breakdown-divider"></div>
                <div class="breakdown-row"><span>25-yr gross savings (degraded + inflated)</span><strong class="positive">+${formatPHPShort(grossLifetime)}</strong></div>
                <div class="breakdown-row"><span>25-yr O&amp;M total</span><strong class="planned">−${formatPHPShort(totalOM)}</strong></div>
                <div class="breakdown-row"><span>Inverter replacement</span><strong class="planned">−${formatPHPShort(r.inverterReplacementCost)}</strong></div>
                <div class="breakdown-divider"></div>
                <div class="breakdown-row"><span>Net 25-yr savings</span><strong class="positive">${formatPHPShort(r.totalLifetimeSavings)}</strong></div>
                <div class="breakdown-row"><span>Net profit (savings − cost)</span><strong class="positive">${formatPHPShort(r.totalLifetimeSavings - r.estimatedSystemCost)}</strong></div>
                <div class="breakdown-row"><span>Year-1 net cash flow</span><strong>${formatPHPShort(year1.netAnnual)}</strong></div>
                <div class="breakdown-row"><span>Year-25 net cash flow</span><strong>${formatPHPShort(year25.netAnnual)}</strong></div>
            `;
        }

        // Store results for report
        window.solarCalcResults = {
            scale, type,
            systemCapacity: r.displayKwp,
            numPanels: r.displayPanels,
            areaUsed: r.displayArea,
            monthlyBill: bill, rate,
            monthlyGeneration: r.effectiveDailySolarKwh * DAYS_PER_MONTH,
            monthlySavings: r.effectiveMonthlySavings,
            annualSavings: r.annualSavings,
            billOffset: Math.min(r.effectiveOffset, 100),
            estimatedSystemCost: r.estimatedSystemCost, costPerKwp: r.costPerKwp,
            estimatedSystemCostLow: r.estimatedSystemCostLow, estimatedSystemCostHigh: r.estimatedSystemCostHigh,
            paybackYears: r.paybackYears, roi: r.roi,
            lifetimeSavings: r.totalLifetimeSavings,
            batteryConfig: r.batteryConfig
        };

        // Energy flow details
        elements.detMonthlyGen.textContent = (r.effectiveDailySolarKwh * DAYS_PER_MONTH).toFixed(1) + " kWh";
        elements.detDirectCons.textContent = (r.directConsumedKwh * DAYS_PER_MONTH).toFixed(1) + " kWh";
        elements.detSurplus.textContent = (r.surplusSolarKwh * DAYS_PER_MONTH).toFixed(1) + " kWh";
        elements.detMonthlyReq.textContent = r.monthlyKwh.toFixed(1) + " kWh";

        // Battery assessment box
        if (type === 'Grid-Tied') {
            elements.detConfigTitle.textContent = "Battery Recommendation";
            if (r.surplusSolarKwh > 0) {
                const suggestedBattery = findOptimalBattery(r.surplusSolarKwh, scale);
                elements.detConfigContent.innerHTML = `<p class="config-detail">Adding <strong>${suggestedBattery.numUnits}x ${suggestedBattery.label}</strong> (${suggestedBattery.totalKwh.toFixed(1)} kWh total) would capture surplus solar for nighttime use.</p>`;
            } else {
                elements.detConfigContent.innerHTML = `<p class="config-success">Your daytime load consumes all solar. Battery is optional for backup only.</p>`;
            }
        } else {
            elements.detConfigTitle.textContent = type + " Storage Setup";
            elements.detConfigContent.innerHTML = `
                <ul class="config-list">
                    <li>Target Backup: <strong>${backupHours} hours</strong></li>
                    <li>Total Battery Units: <strong>${r.numBatt}x ${r.batteryUnitLabel}</strong></li>
                    <li>Total Capacity: <strong>${r.batteryCapacityTotal.toFixed(1)} kWh</strong></li>
                </ul>
            `;
        }

        // Status alerts
        elements.statusAlerts.innerHTML = '';

        let actualCat = "";
        if (r.displayKwp <= 20) actualCat = "Residential";
        else if (r.displayKwp <= 300) actualCat = "C&I";
        else actualCat = "Utility Scale";

        if (scale !== actualCat) {
            const alert = document.createElement('div');
            alert.className = 'status-alert scale-alert';
            alert.innerHTML = `<strong>Note:</strong> System sized as <strong>${actualCat}</strong> (${r.displayKwp.toFixed(1)} kWp). Consider switching Project Scale to <strong>${actualCat}</strong> for optimized battery options and pricing.`;
            elements.statusAlerts.appendChild(alert);
        }

        if (r.isSpaceLimited) {
            const warning = document.createElement('div');
            warning.className = 'status-alert space-warning';
            const offsetMax = r.dailyKwh > 0 ? (r.effectiveDailySolarKwh / r.dailyKwh * 100) : 0;
            warning.innerHTML = `<strong>Space limited:</strong> Your ${area} sqm area fits ${r.cappedPanelsPossible} panels (${offsetMax.toFixed(1)}% offset). To reach ${solarTargetPct}% target, try increasing area to <strong>${(r.numPanelsRequired * PANEL_SIZE_SQM).toFixed(0)} sqm</strong> or reducing your target.`;
            elements.statusAlerts.appendChild(warning);
        }

        // Honest surplus notice: a grid-tied system with no net metering wastes daytime surplus.
        if (type === 'Grid-Tied' && !enableNetMetering && r.surplusSolarKwh > 0.15 * r.effectiveDailySolarKwh) {
            const wastedKwhMo = r.surplusSolarKwh * DAYS_PER_MONTH;
            const potentialCredit = wastedKwhMo * genChargeRate;
            const info = document.createElement('div');
            info.className = 'status-alert surplus-info';
            info.innerHTML = `<strong>You'd generate more than your daytime usage.</strong> About <strong>${wastedKwhMo.toFixed(0)} kWh/mo</strong> of solar would go unused. Turn on <strong>Net Metering</strong> to sell it back (≈ ${formatPHP(potentialCredit)}/mo credit), add a battery to store it, or reduce your Target Solar Coverage.`;
            elements.statusAlerts.appendChild(info);
        }

        // Update Phase 6 features
        if (savingsChart) savingsChart.update({ yearlyCumulative: r.yearlyCumulative, estimatedSystemCost: r.estimatedSystemCost, paybackYears: r.paybackYears, annualSavings: r.annualSavings });
        updateComparisonTable(params);
        updateSensitivityAnalysis(params);
        updateRecommendedArea();
        renderEquipment(scale, type, r);
        renderFinancing(r.estimatedSystemCost, r.effectiveMonthlySavings);
        updateContactLinks();

        saveToLocalStorage();
    }

    const debouncedCalculate = debounce(calculate, DEBOUNCE_MS);

    // ==================== SYSTEM COMPARISON TABLE ====================
    function updateComparisonTable(baseParams) {
        const tbody = document.getElementById('comparisonBody');
        if (!tbody) return;

        const types = ['Grid-Tied', 'Hybrid', 'Off-Grid'];
        const results = {};

        types.forEach(t => {
            const p = Object.assign({}, baseParams, { type: t });
            if (t === 'Off-Grid') p.solarTargetPct = 100;
            results[t] = computeSolar(p);
        });

        const rows = [
            { label: 'System Capacity', fn: r => r.displayKwp.toFixed(2) + ' kWp' },
            { label: 'Panels Required', fn: r => r.displayPanels.toString() },
            { label: 'Area Used', fn: r => r.displayArea.toFixed(1) + ' m\u00B2' },
            { label: 'Est. System Cost', fn: r => formatPHPShort(r.estimatedSystemCost) },
            { label: 'Monthly Savings', fn: r => formatPHP(r.effectiveMonthlySavings) },
            { label: 'Payback Period', fn: r => r.paybackYears > 0 ? r.paybackYears.toFixed(1) + ' years' : 'N/A' },
            { label: '25-Year ROI', fn: r => r.roi > 0 ? r.roi.toFixed(0) + '%' : 'N/A' },
            { label: 'Battery Config', fn: r => r.batteryConfig }
        ];

        tbody.innerHTML = rows.map(row => {
            return '<tr>' +
                '<td class="comp-metric-label">' + row.label + '</td>' +
                types.map(t => {
                    const isActive = t === baseParams.type;
                    return '<td class="' + (isActive ? 'comp-active' : '') + '">' + row.fn(results[t]) + '</td>';
                }).join('') +
            '</tr>';
        }).join('');

        // Highlight active column header
        const colIds = { 'Grid-Tied': 'compColGridTied', 'Hybrid': 'compColHybrid', 'Off-Grid': 'compColOffGrid' };
        types.forEach(t => {
            const el = document.getElementById(colIds[t]);
            if (el) el.classList.toggle('comp-active-header', t === baseParams.type);
        });
    }

    // ==================== SENSITIVITY ANALYSIS ====================
    function updateSensitivityAnalysis(baseParams) {
        const gridEl = document.getElementById('sensitivityGrid');
        if (!gridEl) return;

        const baseResults = computeSolar(baseParams);

        const variables = [
            { name: 'Electricity Rate', key: 'rate', variations: [-40, -20, 0, 20, 40], format: v => '₱' + v.toFixed(1) + '/kWh' },
            { name: 'Monthly Bill', key: 'bill', variations: [-40, -20, 0, 20, 40], format: v => formatPHPShort(v) },
            { name: 'Available Area', key: 'area', variations: [-50, -25, 0, 25, 50], format: v => v.toFixed(0) + ' sqm' }
        ];

        gridEl.innerHTML = variables.map(variable => {
            const tableRows = variable.variations.map(pctChange => {
                const modParams = Object.assign({}, baseParams);
                modParams[variable.key] = baseParams[variable.key] * (1 + pctChange / 100);
                if (modParams[variable.key] < 0) modParams[variable.key] = 0;
                const res = computeSolar(modParams);

                const isBaseline = pctChange === 0;
                const isBetter = res.roi > baseResults.roi + 0.5;
                const isWorse = res.roi < baseResults.roi - 0.5;
                const cls = isBaseline ? 'sensitivity-baseline' : (isBetter ? 'sensitivity-better' : (isWorse ? 'sensitivity-worse' : ''));

                return `<tr class="${cls}">
                    <td>${pctChange === 0 ? 'Baseline' : (pctChange > 0 ? '+' : '') + pctChange + '%'}</td>
                    <td>${variable.format(modParams[variable.key])}</td>
                    <td>${res.paybackYears > 0 ? res.paybackYears.toFixed(1) + 'y' : 'N/A'}</td>
                    <td>${res.roi > 0 ? res.roi.toFixed(0) + '%' : 'N/A'}</td>
                    <td>${formatPHPShort(res.effectiveMonthlySavings)}</td>
                </tr>`;
            }).join('');

            return `<div class="sensitivity-card">
                <h5>${variable.name}</h5>
                <table class="sensitivity-table">
                    <thead><tr><th>Change</th><th>Value</th><th>Payback</th><th>ROI</th><th>Monthly</th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>`;
        }).join('');
    }

    // ==================== EQUIPMENT RECOMMENDATION ====================
    function pickInverter(scale, kWp) {
        const cfg = window.KINMO_EQUIPMENT;
        if (!cfg || !cfg.inverterTiers) return null;
        const tiers = cfg.inverterTiers[scale] || cfg.inverterTiers['Residential'];
        if (!tiers || !tiers.length) return null;
        for (const t of tiers) {
            if (kWp <= t.upToKwp) return { model: t.model, qty: 1, note: '' };
        }
        const last = tiers[tiers.length - 1];
        const qty = Math.max(1, Math.ceil(kWp / last.upToKwp));
        return { model: last.model, qty: qty, note: qty + ' units to cover ' + kWp.toFixed(1) + ' kWp' };
    }

    function renderEquipment(scale, type, r) {
        const cfg = window.KINMO_EQUIPMENT;
        const grid = document.getElementById('equipmentGrid');
        const disc = document.getElementById('equipmentDisclaimer');
        if (!grid) return;
        if (!cfg) { grid.innerHTML = ''; return; }
        if (disc && cfg.disclaimer) disc.textContent = cfg.disclaimer;

        if (!r || r.displayKwp <= 0) {
            grid.innerHTML = '<p class="equipment-empty">Enter your details to see recommended hardware.</p>';
            return;
        }

        const watt = parseInt(elements.wattage.value, 10) || 620;
        const cards = [{
            label: 'Solar Panels',
            value: r.displayPanels + ' × ' + watt + 'W',
            sub: r.displayKwp.toFixed(2) + ' kWp array'
        }];

        const inv = pickInverter(scale, r.displayKwp);
        if (inv) {
            cards.push({
                label: 'Inverter',
                value: (inv.qty > 1 ? inv.qty + ' × ' : '') + inv.model,
                sub: inv.note
            });
        }

        if ((type === 'Hybrid' || type === 'Off-Grid') && r.batteryCapacityTotal > 0 && cfg.battery) {
            const units = Math.max(1, Math.ceil(r.batteryCapacityTotal / cfg.battery.unitKwh));
            cards.push({
                label: 'Battery — ' + cfg.battery.brand,
                value: units + ' × ' + cfg.battery.model,
                sub: '≈ ' + (units * cfg.battery.unitKwh).toFixed(1) + ' kWh (' + r.batteryCapacityTotal.toFixed(1) + ' kWh required)'
            });
        }

        grid.innerHTML = cards.map(c => `
            <div class="equipment-card">
                <span class="equipment-label">${c.label}</span>
                <span class="equipment-value">${c.value}</span>
                ${c.sub ? '<span class="equipment-sub">' + c.sub + '</span>' : ''}
            </div>`).join('');
    }

    // ==================== FINANCING SCENARIO ====================
    const FIN_DOWNPAYMENT_PCT = 0.20;
    const FIN_TERM_MONTHS = 60;

    function renderFinancing(systemCost, monthlySavings) {
        const resEl = document.getElementById('financingResults');
        const verdictEl = document.getElementById('financingVerdict');
        const finInterestEl = document.getElementById('finInterest');
        if (!resEl || !verdictEl) return;

        const interest = Math.max(0, parseFloat(finInterestEl && finInterestEl.value) || 0);
        const down = systemCost * FIN_DOWNPAYMENT_PCT;
        const principal = systemCost - down;
        const r = interest / 100 / 12;
        const monthly = r > 0
            ? principal * r / (1 - Math.pow(1 + r, -FIN_TERM_MONTHS))
            : (FIN_TERM_MONTHS > 0 ? principal / FIN_TERM_MONTHS : 0);
        const net = monthlySavings - monthly;

        resEl.innerHTML = `
            <div class="financing-row"><span>Downpayment (20%)</span><strong>${formatPHPShort(down)}</strong></div>
            <div class="financing-row"><span>Loan amount</span><strong>${formatPHPShort(principal)}</strong></div>
            <div class="financing-row"><span>Monthly amortization (5 yr @ ${interest}%)</span><strong>${formatPHP(monthly)}</strong></div>
            <div class="financing-row"><span>Est. monthly savings</span><strong class="positive">${formatPHP(monthlySavings)}</strong></div>
            <div class="financing-divider"></div>
            <div class="financing-row financing-net"><span>Net monthly cash flow</span><strong class="${net >= 0 ? 'positive' : 'negative'}">${(net >= 0 ? '+' : '') + formatPHP(net)}</strong></div>
        `;

        if (systemCost <= 0) { verdictEl.textContent = ''; verdictEl.className = 'financing-verdict'; return; }
        if (net >= 0) {
            verdictEl.className = 'financing-verdict positive';
            verdictEl.innerHTML = '<strong>Cash-flow positive from day one</strong> — estimated savings cover the loan payment with ' + formatPHPShort(net) + '/mo to spare.';
        } else {
            verdictEl.className = 'financing-verdict';
            verdictEl.innerHTML = 'During the 5-year term the payment is <strong>' + formatPHPShort(-net) + '/mo</strong> more than the savings. Once the loan is fully paid (year 5+), you keep the full <strong>' + formatPHPShort(monthlySavings) + '/mo</strong>.';
        }
    }

    const finInterestInput = document.getElementById('finInterest');
    if (finInterestInput) {
        finInterestInput.addEventListener('input', () => {
            const res = window.solarCalcResults || {};
            renderFinancing(res.estimatedSystemCost || 0, res.monthlySavings || 0);
        });
    }

    // ==================== INSTANT PDF REPORT ====================
    // Load the Kinmo logo once as a PNG data URL (same-origin -> canvas not tainted).
    let logoInfo = null;
    function loadLogo() {
        return new Promise((resolve) => {
            if (logoInfo !== null) return resolve(logoInfo);
            const img = new Image();
            img.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth; c.height = img.naturalHeight;
                    c.getContext('2d').drawImage(img, 0, 0);
                    logoInfo = { dataUrl: c.toDataURL('image/png'), ratio: (img.naturalWidth / img.naturalHeight) || 1 };
                } catch (e) { logoInfo = { dataUrl: null, ratio: 1 }; }
                resolve(logoInfo);
            };
            img.onerror = () => { logoInfo = { dataUrl: null, ratio: 1 }; resolve(logoInfo); };
            img.src = 'logo.png';
        });
    }

    async function generatePDF() {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert('The PDF generator is still loading — please try again in a moment.');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const res = window.solarCalcResults || {};
        const num = (v, d = 0) => (typeof v === 'number' && isFinite(v)) ? v : d;
        const custName = ((document.getElementById('customerName') || {}).value || '').trim() || 'Valued Customer';
        const custLoc = ((document.getElementById('customerLocation') || {}).value || '').trim() || '—';
        const dateStr = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
        const peso = v => 'PHP ' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const pesoShort = v => { v = Number(v || 0); return v >= 1e6 ? 'PHP ' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? 'PHP ' + (v / 1e3).toFixed(0) + 'K' : 'PHP ' + v.toFixed(0); };
        const pesoRange = (lo, hi) => { const step = Number(hi||0) < 1e6 ? 20000 : 50000; let a = Math.floor((Number(lo)||0)/step)*step; let b = Math.ceil((Number(hi)||0)/step)*step; if (b <= a) b = a + step; if (a >= 1e6 && b >= 1e6) return 'PHP ' + (a/1e6).toFixed(2) + '–' + (b/1e6).toFixed(2) + 'M'; if (b < 1e6) return 'PHP ' + (a/1e3).toFixed(0) + '–' + (b/1e3).toFixed(0) + 'K'; return pesoShort(a) + ' – ' + pesoShort(b); };
        const logo = await loadLogo();


        const NAVY=[15,23,42], NAVY2=[30,41,59], BLUE=[37,99,235], GREEN=[22,163,74], EMER=[16,185,129],
          AMBER=[245,158,11], AMBER2=[251,191,36], SLATE=[71,85,105], SLATE2=[100,116,139],
          LSLATE=[148,163,184], WHITE=[255,255,255], PAPER=[240,243,247], LINE=[226,232,240], CARD=[255,255,255], SKY=[219,234,254];
        const W=595, H=842, M=40;
        const sf=c=>doc.setFillColor(c[0],c[1],c[2]);
        const sd=c=>doc.setDrawColor(c[0],c[1],c[2]);
        const st=c=>doc.setTextColor(c[0],c[1],c[2]);
        const F=(s,w='normal')=>doc.setFont('helvetica',w).setFontSize(s);
        const txt=(s,x,y,o={})=>{ if(o.font)doc.setFont('helvetica',o.font); if(o.size)doc.setFontSize(o.size); if(o.color)st(o.color); doc.text(String(s),x,y,{align:o.align||'left',baseline:o.baseline||'alphabetic'}); };

        sf(PAPER); doc.rect(0,0,W,H,'F');

        const HH=100;
        sf(NAVY); doc.rect(0,0,W,HH,'F');
        sf(NAVY2); doc.triangle(W-150,0,W,0,W,HH,'F');
        sf(BLUE); doc.triangle(W-60,0,W,0,W,60,'F');
        sf(AMBER); doc.rect(0,HH,W,3,'F');
        const lc=HH/2, lx=M+22;
        sf(WHITE); doc.circle(lx,lc,24,'F');
        if(logo&&logo.dataUrl){ try{ doc.addImage(logo.dataUrl,'PNG',lx-20,lc-20,40,40); }catch(e){} }
        txt('Solar Feasibility Report', lx+40, lc-8, {font:'bold', size:21, color:WHITE, baseline:'middle'});
        txt('KINMO PW CORPORATION', lx+40, lc+13, {font:'bold', size:9, color:[147,197,253], baseline:'middle'});
        txt('Solar EPC — Design, Supply & Install', lx+40, lc+25, {font:'normal', size:8, color:LSLATE, baseline:'middle'});
        txt(dateStr, W-M, lc-8, {font:'normal', size:9, color:[203,213,225], align:'right', baseline:'middle'});
        txt('CONFIDENTIAL PROPOSAL', W-M, lc+10, {font:'bold', size:7.5, color:AMBER2, align:'right', baseline:'middle'});

        let y=HH+3+18;
        sf(WHITE); doc.roundedRect(M,y,W-2*M,34,5,5,'F');
        sf(BLUE); doc.roundedRect(M,y,4,34,2,2,'F');
        txt('PREPARED FOR', M+16, y+13, {font:'bold', size:7.5, color:SLATE2});
        txt(custName, M+16, y+27, {font:'bold', size:12.5, color:NAVY});
        txt('LOCATION', W-M-16, y+13, {font:'bold', size:7.5, color:SLATE2, align:'right'});
        txt(custLoc, W-M-16, y+27, {font:'bold', size:12.5, color:NAVY, align:'right'});

        y+=34+16;
        const gap=12, cardW=(W-2*M-2*gap)/3, cardH=76;
        const cards=[
          {label:'ESTIMATED SYSTEM COST', val:pesoRange(res.estimatedSystemCostLow, res.estimatedSystemCostHigh), sub:'VAT-exclusive · turnkey install', accent:BLUE, tint:SKY},
          {label:'PAYBACK PERIOD', val:num(res.paybackYears)?num(res.paybackYears).toFixed(1)+' yrs':'N/A', sub:'Break-even point', accent:AMBER, tint:[254,243,199]},
          {label:'25-YEAR ROI', val:num(res.roi)?num(res.roi).toFixed(0)+'%':'N/A', sub:'Return on investment', accent:GREEN, tint:[220,252,231]},
        ];
        cards.forEach((c,i)=>{
          const x=M+i*(cardW+gap);
          sf(CARD); doc.roundedRect(x,y,cardW,cardH,7,7,'F');
          sf(c.accent); doc.roundedRect(x,y,cardW,5,7,7,'F'); sf(c.accent); doc.rect(x,y+3,cardW,3,'F');
          sf(c.tint); doc.circle(x+16,y+26,7,'F');
          sf(c.accent); doc.circle(x+16,y+26,3,'F');
          txt(c.label, x+28, y+28, {font:'bold', size:7.5, color:SLATE2});
          let vfs=20; doc.setFont('helvetica','bold'); doc.setFontSize(vfs);
          while (vfs>11 && doc.getTextWidth(String(c.val)) > cardW-26) { vfs-=0.5; doc.setFontSize(vfs); }
          txt(c.val, x+14, y+52, {font:'bold', size:vfs, color:NAVY});
          txt(c.sub, x+14, y+66, {font:'normal', size:7.5, color:LSLATE});
        });

        y+=cardH+16;
        const colGap=14, leftW=308, rightW=W-2*M-leftW-colGap, leftX=M, rightX=M+leftW+colGap;
        const bodyH=288;
        sf(CARD); doc.roundedRect(leftX,y,leftW,bodyH,8,8,'F');
        txt('THE NUMBERS AT A GLANCE', leftX+16, y+22, {font:'bold', size:9.5, color:NAVY});
        sd(LINE); doc.setLineWidth(0.7); doc.line(leftX+16,y+30,leftX+leftW-16,y+30);
        let by=y+46;
        txt('25-Year Net Savings  vs  System Cost', leftX+16, by, {font:'bold', size:8.5, color:SLATE});
        by+=12;
        const barX=leftX+120, barMaxW=leftW-16-(barX-leftX);
        const maxVal=Math.max(num(res.lifetimeSavings), num(res.estimatedSystemCost), 1);
        const bar=(rowY,label,val,color,valStr)=>{
          txt(label, leftX+16, rowY+9, {font:'bold', size:8, color:SLATE2});
          const bw=Math.max(6, barMaxW*(num(val)/maxVal));
          sf([236,240,245]); doc.roundedRect(barX,rowY,barMaxW,13,3,3,'F');
          sf(color); doc.roundedRect(barX,rowY,bw,13,3,3,'F');
          const inside=bw>70;
          txt(valStr, inside?barX+bw-6:barX+bw+5, rowY+9.3, {font:'bold', size:8, color:inside?WHITE:NAVY, align:inside?'right':'left'});
        };
        bar(by, '25-Yr Savings', res.lifetimeSavings, GREEN, pesoShort(res.lifetimeSavings)); by+=22;
        bar(by, 'System Cost', res.estimatedSystemCost, BLUE, pesoShort(res.estimatedSystemCost)); by+=22;
        txt('Net lifetime gain', leftX+16, by+9, {font:'normal', size:8, color:LSLATE});
        txt('+ '+pesoShort(num(res.lifetimeSavings)-num(res.estimatedSystemCost)), barX, by+9, {font:'bold', size:8.5, color:GREEN});
        by+=30;
        sd(LINE); doc.setLineWidth(0.5); doc.line(leftX+16,by,leftX+leftW-16,by);
        by+=18;
        txt('MONTHLY BILL OFFSET', leftX+16, by, {font:'bold', size:8.5, color:SLATE});
        const dcx=leftX+70, dcy=by+60, dR=42, dr=27;
        const pct=Math.max(0,Math.min(1,num(res.billOffset)/100));
        const ring=(cx,cy,R,r,startFrac,endFrac,color)=>{
          sf(color);
          const a0=-Math.PI/2 + startFrac*2*Math.PI, a1=-Math.PI/2 + endFrac*2*Math.PI;
          const n=Math.max(2,Math.round(120*(endFrac-startFrac)));
          for(let i=0;i<n;i++){
            const t0=a0+(a1-a0)*(i/n), t1=a0+(a1-a0)*((i+1)/n);
            const ox0=cx+R*Math.cos(t0),oy0=cy+R*Math.sin(t0),ox1=cx+R*Math.cos(t1),oy1=cy+R*Math.sin(t1);
            const ix0=cx+r*Math.cos(t0),iy0=cy+r*Math.sin(t0),ix1=cx+r*Math.cos(t1),iy1=cy+r*Math.sin(t1);
            doc.triangle(ox0,oy0,ox1,oy1,ix1,iy1,'F');
            doc.triangle(ox0,oy0,ix1,iy1,ix0,iy0,'F');
          }
        };
        ring(dcx,dcy,dR,dr,0,1,[226,232,240]);
        if(pct>0) ring(dcx,dcy,dR,dr,0,pct,AMBER);
        txt(num(res.billOffset).toFixed(0)+'%', dcx, dcy-2, {font:'bold', size:17, color:NAVY, align:'center', baseline:'middle'});
        txt('offset', dcx, dcy+13, {font:'normal', size:7.5, color:SLATE2, align:'center', baseline:'middle'});
        const lgx=dcx+dR+24; let lgy=by+28;
        sf(AMBER); doc.roundedRect(lgx,lgy-7,10,10,2,2,'F');
        txt('Covered by solar', lgx+16, lgy+1, {font:'bold', size:8, color:SLATE, baseline:'middle'});
        txt(num(res.billOffset).toFixed(0)+'% of your bill', lgx+16, lgy+13, {font:'normal', size:7.5, color:LSLATE, baseline:'middle'});
        lgy+=34;
        sf([226,232,240]); doc.roundedRect(lgx,lgy-7,10,10,2,2,'F');
        txt('From the grid', lgx+16, lgy+1, {font:'bold', size:8, color:SLATE, baseline:'middle'});
        txt((100-num(res.billOffset)).toFixed(0)+'% remaining', lgx+16, lgy+13, {font:'normal', size:7.5, color:LSLATE, baseline:'middle'});
        lgy+=34;
        txt('Est. monthly savings', lgx+16, lgy+1, {font:'normal', size:7.5, color:SLATE2, baseline:'middle'});
        txt(peso(res.monthlySavings).replace('.00',''), lgx+16, lgy+13, {font:'bold', size:9, color:GREEN, baseline:'middle'});

        sf(CARD); doc.roundedRect(rightX,y,rightW,bodyH,8,8,'F');
        sf(NAVY); doc.roundedRect(rightX,y,rightW,26,8,8,'F'); sf(NAVY); doc.rect(rightX,y+13,rightW,13,'F');
        txt('SYSTEM & FINANCIAL DETAILS', rightX+14, y+17, {font:'bold', size:9, color:WHITE});
        const rows=[
          ['Project Type', res.scale||'—'],
          ['Configuration', res.type||'—'],
          ['System Capacity', num(res.systemCapacity).toFixed(2)+' kWp'],
          ['Number of Panels', String(num(res.numPanels))],
          ['Battery', res.batteryConfig||'None'],
          ['Monthly Bill', peso(res.monthlyBill).replace('.00','')],
          ['Est. Monthly Savings', peso(res.monthlySavings).replace('.00','')],
          ['Est. Annual Savings', peso(res.annualSavings).replace('.00','')],
          ['Bill Offset', num(res.billOffset).toFixed(1)+'%'],
          ['25-Year Net Savings', peso(res.lifetimeSavings).replace('.00','')],
        ];
        const ry=y+26, rowH=(bodyH-26-8)/rows.length;
        rows.forEach((r,i)=>{
          const yy=ry+i*rowH;
          if(i%2===1){ sf([245,247,250]); doc.rect(rightX+1,yy,rightW-2,rowH,'F'); }
          doc.setFont('helvetica','normal'); doc.setFontSize(8.5); const lw=doc.getTextWidth(String(r[0]));
          txt(r[0], rightX+14, yy+rowH/2+0.5, {font:'normal', size:8.5, color:SLATE, baseline:'middle'});
          const highlight=/Savings|Offset/.test(r[0]);
          let vfs=9; doc.setFont('helvetica','bold'); doc.setFontSize(vfs);
          const avail=rightW-28-lw-10;
          while(vfs>6.5 && doc.getTextWidth(String(r[1]))>avail){ vfs-=0.5; doc.setFontSize(vfs); }
          txt(r[1], rightX+rightW-14, yy+rowH/2+0.5, {font:'bold', size:vfs, color:highlight?GREEN:NAVY, align:'right', baseline:'middle'});
        });

        y+=bodyH+14;
        const wgH=108;
        sf(CARD); doc.roundedRect(M,y,W-2*M,wgH,8,8,'F');
        sf(GREEN); doc.roundedRect(M,y,4,wgH,2,2,'F');
        txt('WHAT YOU GET WITH KINMO PW', M+16, y+20, {font:'bold', size:10, color:NAVY});
        sd(LINE); doc.setLineWidth(0.6); doc.line(M+16,y+27,W-M-16,y+27);
        const midX=M+(W-2*M)/2;
        const chkline=(x,yy,bold,rest)=>{
          sf([220,252,231]); doc.circle(x+4,yy-3,5.5,'F');
          sd(GREEN); doc.setLineWidth(1.2);
          doc.line(x+1.5,yy-3,x+3.2,yy-1.2); doc.line(x+3.2,yy-1.2,x+6.6,yy-5.4);
          txt(bold, x+15, yy, {font:'bold', size:8.5, color:NAVY});
          if(rest) txt(rest, x+15, yy+11, {font:'normal', size:8, color:SLATE2});
        };
        const ex=M+16, eyy=y+44;
        chkline(ex,eyy,'GoodWe','Tier-1 hybrid inverters');
        chkline(ex,eyy+34,'Kinmo PW power-quality brands','Northstar · UNI-T · YIY');
        const tx=midX+6, tyy=y+44;
        chkline(tx,tyy,'Professional installation','On-site assessment included');
        chkline(tx,tyy+24,'Net-metering filing','We file with your utility');
        chkline(tx,tyy+48,'Manufacturer warranties','On all supplied equipment');
        sd(LINE); doc.setLineWidth(0.6); doc.line(midX-4,y+38,midX-4,y+wgH-12);

        y+=wgH+12;
        const tlH=54;
        sf(NAVY); doc.roundedRect(M,y,W-2*M,tlH,8,8,'F');
        txt('PROJECTED CASH TIMELINE', M+16, y+17, {font:'bold', size:8.5, color:[147,197,253]});
        const tlx=M+16, tlw=W-2*M-32, tly=y+36;
        sf(NAVY2); doc.roundedRect(tlx,tly,tlw,6,3,3,'F');
        const pf=Math.max(0,Math.min(1,num(res.paybackYears)/25));
        sf(AMBER); doc.roundedRect(tlx,tly,tlw*pf,6,3,3,'F');
        sf(EMER); doc.roundedRect(tlx+tlw*pf,tly,tlw*(1-pf),6,3,3,'F'); sf(EMER); doc.rect(tlx+tlw*pf,tly,3,6,'F');
        const marker=(frac,col)=>{ const mx=tlx+tlw*frac; sf(WHITE); doc.circle(mx,tly+3,4,'F'); sf(col); doc.circle(mx,tly+3,2.4,'F'); };
        marker(0,BLUE); marker(pf,AMBER); marker(1,EMER);
        txt('Year 0 — Install', tlx, tly-8, {font:'bold', size:7.5, color:WHITE});
        txt('Year 25 — '+pesoShort(res.lifetimeSavings), tlx+tlw, tly-8, {font:'bold', size:7.5, color:[110,231,183], align:'right'});
        const beX=Math.max(tlx+52, Math.min(tlx+tlw-52, tlx+tlw*pf));
        txt('Break-even · Year '+num(res.paybackYears).toFixed(1), beX, tly+16, {font:'bold', size:7.5, color:AMBER2, align:'center'});

        y+=tlH+12;
        const disc='All prices are VAT-exclusive. Rough estimate only. Lifetime model assumes 0.4%/yr panel degradation, 4.5%/yr electricity rate inflation, annual O&M (1.5–2.0% of contract price), and one inverter replacement at Year 12. Request a formal quotation for final ROI and hardware scope.';
        F(7,'italic'); st(LSLATE);
        const dl=doc.splitTextToSize(disc, W-2*M);
        doc.setFont('helvetica','italic'); doc.text(dl, M, y);
        y+= dl.length*8.5 + 8;
        const cbH=34;
        sf(NAVY); doc.roundedRect(M,y,W-2*M,cbH,6,6,'F');
        sf(AMBER); doc.roundedRect(M,y,4,cbH,2,2,'F');
        txt('Office: 09778407799 · 09167050208', M+16, y+13, {font:'bold', size:8, color:WHITE});
        txt('Sales: 09687269310 (Earl Dy)', M+16, y+25, {font:'normal', size:8, color:[203,213,225]});
        txt('earldy.kpwunibest@gmail.com', W-M-14, y+13, {font:'bold', size:8.5, color:AMBER2, align:'right'});
        txt('Kinmo PW Corporation — Solar EPC', W-M-14, y+25, {font:'normal', size:7.5, color:LSLATE, align:'right'});

        doc.save('Kinmo-Solar-Report.pdf');
    }

    const btnDownloadPdf = document.getElementById('btnDownloadPdf');
    if (btnDownloadPdf) btnDownloadPdf.addEventListener('click', () => {
        generatePDF().catch((e) => { console.error('PDF generation failed:', e); alert('Sorry, the PDF could not be generated. Please try again.'); });
    });
    loadLogo(); // warm the logo cache so the first download is instant

    // ==================== LOCAL STORAGE ====================
    function saveToLocalStorage() {
        const state = {
            projectScale: elements.projectScale.value,
            systemType: elements.systemType.value,
            bill: elements.bill.value,
            rate: elements.rate.value,
            solarTarget: elements.solarTarget.value,
            area: elements.area.value,
            wattage: elements.wattage.value,
            daytimeLoad: elements.daytimeLoad.value,
            backupHours: elements.backupHours.value,
            enableNetMetering: elements.enableNetMetering.checked,
            genCharge: elements.genCharge.value,
            currentShift,
            roofType: elements.roofType.value,
            region: elements.region ? elements.region.value : 'metro_manila'
        };
        try {
            localStorage.setItem('solarCalcState', JSON.stringify(state));
        } catch (e) { /* quota exceeded or private mode */ }
    }

    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('solarCalcState');
            if (!saved) return false;
            const state = JSON.parse(saved);
            if (state.projectScale) elements.projectScale.value = state.projectScale;
            if (state.projectScale) updateRoofTypeOptions();
            if (state.systemType) elements.systemType.value = state.systemType;
            if (state.bill) elements.bill.value = state.bill;
            if (state.rate) elements.rate.value = state.rate;
            if (state.region && elements.region) elements.region.value = state.region;
            if (state.solarTarget) elements.solarTarget.value = state.solarTarget;
            if (state.roofType) elements.roofType.value = state.roofType;
            if (state.area) elements.area.value = state.area;
            if (state.wattage) elements.wattage.value = state.wattage;
            if (state.daytimeLoad) elements.daytimeLoad.value = state.daytimeLoad;
            if (state.backupHours) elements.backupHours.value = state.backupHours;
            if (state.enableNetMetering !== undefined) elements.enableNetMetering.checked = state.enableNetMetering;
            if (state.genCharge) elements.genCharge.value = state.genCharge;
            if (state.currentShift) currentShift = state.currentShift;
            return true;
        } catch { return false; }
    }

    function loadFromURL() {
        const params = new URLSearchParams(window.location.search);
        if (params.size === 0) return false;
        const map = { scale: 'projectScale', type: 'systemType', bill: 'bill', rate: 'rate', region: 'region', target: 'solarTarget', area: 'area', watt: 'wattage', daytime: 'daytimeLoad', backup: 'backupHours', gencharge: 'genCharge' };
        let found = false;
        for (const [param, elKey] of Object.entries(map)) {
            const val = params.get(param);
            if (val && elements[elKey]) { elements[elKey].value = val; found = true; }
        }
        if (params.get('netmeter') === '1') { elements.enableNetMetering.checked = true; found = true; }
        const shift = params.get('shift');
        if (shift) { currentShift = parseInt(shift, 10) || 1; found = true; }
        const roof = params.get('roof');
        if (roof && elements.roofType) {
            updateRoofTypeOptions();
            elements.roofType.value = roof;
            found = true;
        }
        return found;
    }

    function getShareURL() {
        const params = new URLSearchParams();
        params.set('scale', elements.projectScale.value);
        params.set('type', elements.systemType.value);
        params.set('bill', elements.bill.value);
        params.set('rate', elements.rate.value);
        if (elements.region) params.set('region', elements.region.value);
        params.set('target', elements.solarTarget.value);
        params.set('area', elements.area.value);
        params.set('watt', elements.wattage.value);
        params.set('daytime', elements.daytimeLoad.value);
        params.set('backup', elements.backupHours.value);
        if (elements.enableNetMetering.checked) params.set('netmeter', '1');
        params.set('gencharge', elements.genCharge.value);
        if (elements.roofType) params.set('roof', elements.roofType.value);
        params.set('shift', currentShift);
        params.set('view', 'results');
        return window.location.origin + window.location.pathname + '?' + params.toString();
    }

    // ==================== EVENT LISTENERS ====================
    const immediateElements = [elements.projectScale, elements.systemType, elements.enableNetMetering, elements.region].filter(Boolean);
    const debouncedElements = [elements.bill, elements.rate, elements.area, elements.wattage, elements.genCharge];
    const rangeElements = [elements.solarTarget, elements.daytimeLoad, elements.backupHours];

    immediateElements.forEach(el => { el.addEventListener('change', calculate); });

    debouncedElements.forEach(el => {
        el.addEventListener('input', debouncedCalculate);
        el.addEventListener('change', calculate);
        el.addEventListener('blur', () => clampInput(el));
    });

    rangeElements.forEach(el => {
        el.addEventListener('input', calculate);
        el.addEventListener('change', calculate);
    });

    elements.projectScale.addEventListener('change', () => {
        applyScaleVisibility(elements.projectScale.value);
        updateBatteryOptions();
        calculate();
    });

    elements.systemType.addEventListener('change', (e) => {
        const type = e.target.value;
        if (type === 'Off-Grid') {
            elements.offGridInfo.classList.remove('hidden');
            elements.solarTarget.disabled = true;
            elements.solarTargetVal.disabled = true;
            elements.solarTarget.value = 100;
            elements.solarTargetVal.value = 100;
            updateRangeBackground(elements.solarTarget);
        } else {
            elements.offGridInfo.classList.add('hidden');
            elements.solarTarget.disabled = false;
            elements.solarTargetVal.disabled = false;
        }
        if (type === 'Grid-Tied') {
            elements.batterySection.classList.add('hidden');
        } else {
            elements.batterySection.classList.remove('hidden');
        }
    });

    elements.enableNetMetering.addEventListener('change', (e) => {
        if (e.target.checked) { elements.genChargeGroup.classList.remove('hidden'); }
        else { elements.genChargeGroup.classList.add('hidden'); }
    });

    // ==================== ROOF TYPE ESTIMATION ====================
    const roofTypeAreas = {
        Residential: { bungalow: 80, '2story': 50, townhouse: 35, condo: 20 },
        'C&I': { small_commercial: 100, medium_commercial: 300, warehouse: 800 },
        'Utility Scale': { small_land: 2000, large_land: 10000 }
    };

    function updateRoofTypeOptions() {
        const scale = elements.projectScale.value;
        const roofType = elements.roofType;
        roofType.innerHTML = '<option value="custom">I know my area</option>';
        const opts = roofTypeAreas[scale] || roofTypeAreas['Residential'];
        const labels = {
            bungalow: 'Bungalow', '2story': '2-Story House', townhouse: 'Townhouse', condo: 'Apartment / Condo',
            small_commercial: 'Small Office / Shop', medium_commercial: 'Medium Building', warehouse: 'Large Building / Warehouse',
            small_land: 'Open Land (Small)', large_land: 'Open Land (Large)'
        };
        Object.entries(opts).forEach(([key, sqm]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = (labels[key] || key) + ' (~' + sqm + ' sqm)';
            roofType.appendChild(opt);
        });
    }

    elements.roofType.addEventListener('change', () => {
        const scale = elements.projectScale.value;
        const selected = elements.roofType.value;
        if (selected !== 'custom') {
            const opts = roofTypeAreas[scale] || roofTypeAreas['Residential'];
            if (opts[selected]) {
                elements.area.value = opts[selected];
                calculate();
            }
        }
    });

    // Update roof type options when project scale changes
    elements.projectScale.addEventListener('change', () => {
        updateRoofTypeOptions();
        elements.roofType.value = 'custom';
    });

    function updateRecommendedArea() {
        const bill = Math.max(0, parseFloat(elements.bill.value) || 0);
        const rate = Math.max(0.01, parseFloat(elements.rate.value) || 1);
        const solarTargetPct = parseInt(elements.solarTarget.value) || 100;
        const wattage = Math.max(100, parseFloat(elements.wattage.value) || 620);
        const type = elements.systemType.value;
        const psh = REGION_PSH[elements.region.value] || DEFAULT_PSH;
        const dailyKwh = (bill / rate) / DAYS_PER_MONTH;
        const targetDaily = dailyKwh * (solarTargetPct / 100);
        const designFactor = type === 'Off-Grid' ? OFFGRID_DESIGN_FACTOR : 1.0;
        const requiredKwp = (psh * EFFICIENCY > 0) ? (targetDaily / (psh * EFFICIENCY)) * designFactor : 0;
        let panels = Math.ceil((requiredKwp * 1000) / wattage) || 0;
        panels = Math.ceil(panels / PANEL_ROUND_MULTIPLE) * PANEL_ROUND_MULTIPLE;
        const neededArea = panels * PANEL_SIZE_SQM;
        if (elements.recommendedArea && neededArea > 0) {
            elements.recommendedArea.textContent = 'Recommended: ~' + neededArea.toFixed(0) + ' sqm for ' + solarTargetPct + '% coverage';
        }
    }

    updateRoofTypeOptions();

    clearButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-target');
            if (elements[targetId]) { elements[targetId].value = ''; calculate(); }
        });
    });

    shiftOptions.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const shiftValue = parseInt(e.currentTarget.getAttribute('data-shift'));
            currentShift = shiftValue;
            shiftOptions.forEach(opt => { opt.classList.remove('active'); opt.setAttribute('aria-checked', 'false'); });
            e.currentTarget.classList.add('active');
            e.currentTarget.setAttribute('aria-checked', 'true');
            setDaytimeFromShift(currentShift);
            calculate();
        });
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
        });
    });

    if (elements.btnReset) {
        elements.btnReset.addEventListener('click', () => {
            elements.projectScale.value = DEFAULTS.projectScale;
            elements.systemType.value = DEFAULTS.systemType;
            elements.bill.value = DEFAULTS.bill;
            elements.rate.value = DEFAULTS.rate;
            if (elements.region) elements.region.value = 'metro_manila';
            elements.solarTarget.value = DEFAULTS.solarTarget;
            elements.solarTarget.disabled = false;
            elements.solarTargetVal.disabled = false;
            elements.solarTargetVal.value = DEFAULTS.solarTarget;
            elements.daytimeLoadVal.value = DEFAULTS.daytimeLoad;
            elements.backupHoursVal.value = DEFAULTS.backupHours;
            updateRoofTypeOptions();
            elements.roofType.value = 'custom';
            elements.area.value = DEFAULTS.area;
            elements.wattage.value = DEFAULTS.wattage;
            elements.daytimeLoad.value = DEFAULTS.daytimeLoad;
            elements.backupHours.value = DEFAULTS.backupHours;
            elements.enableNetMetering.checked = DEFAULTS.enableNetMetering;
            elements.genCharge.value = DEFAULTS.genCharge;
            currentShift = 1;
            applyScaleVisibility('Residential');
            elements.batterySection.classList.add('hidden');
            elements.offGridInfo.classList.add('hidden');
            elements.genChargeGroup.classList.add('hidden');
            shiftOptions.forEach(opt => { opt.classList.remove('active'); opt.setAttribute('aria-checked', 'false'); });
            if (shiftOptions[0]) { shiftOptions[0].classList.add('active'); shiftOptions[0].setAttribute('aria-checked', 'true'); }
            document.querySelectorAll('input[type="range"]').forEach(updateRangeBackground);
            updateBatteryOptions();
            calculate();
            localStorage.removeItem('solarCalcState');
        });
    }

    const btnShare = document.getElementById('btnShare');
    if (btnShare) {
        btnShare.addEventListener('click', async () => {
            const url = getShareURL();
            try {
                await navigator.clipboard.writeText(url);
                btnShare.textContent = 'Link Copied!';
                setTimeout(() => { btnShare.textContent = 'Share Config'; }, 2000);
            } catch { prompt('Copy this link:', url); }
        });
    }

    // ==================== RANGE SLIDER VISUALS ====================
    function updateRangeBackground(rangeInput) {
        const value = ((rangeInput.value - rangeInput.min) / (rangeInput.max - rangeInput.min)) * 100;
        rangeInput.style.background = `linear-gradient(to right, var(--primary) 0%, var(--primary-dark) ${value}%, rgba(255,255,255,0.1) ${value}%, rgba(255,255,255,0.1) 100%)`;
    }

    document.querySelectorAll('.sidebar input[type="range"]').forEach(slider => {
        updateRangeBackground(slider);
        const handler = (e) => {
            updateRangeBackground(e.target);
            e.target.setAttribute('aria-valuenow', e.target.value);
            if (e.target === elements.daytimeLoad) { elements.daytimeLoadVal.value = e.target.value; }
            else if (e.target === elements.solarTarget) { elements.solarTargetVal.value = e.target.value; }
            else if (e.target === elements.backupHours) { elements.backupHoursVal.value = e.target.value; }
        };
        slider.addEventListener('input', handler);
        slider.addEventListener('change', handler);
    });

    // Inline number inputs → sync back to range sliders
    function syncInlineInput(inputEl, sliderEl) {
        const commit = () => {
            let v = parseInt(inputEl.value, 10);
            const min = parseInt(sliderEl.min, 10);
            const max = parseInt(sliderEl.max, 10);
            if (isNaN(v)) v = min;
            v = Math.max(min, Math.min(max, v));
            inputEl.value = v;
            sliderEl.value = v;
            sliderEl.setAttribute('aria-valuenow', v);
            updateRangeBackground(sliderEl);
            calculate();
        };
        inputEl.addEventListener('change', commit);
        inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); inputEl.blur(); } });
    }
    syncInlineInput(elements.solarTargetVal, elements.solarTarget);
    syncInlineInput(elements.daytimeLoadVal, elements.daytimeLoad);
    syncInlineInput(elements.backupHoursVal, elements.backupHours);

    // ==================== MOBILE SIDEBAR TOGGLE ====================
    const mobileToggle = document.getElementById('mobileToggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (mobileToggle && sidebar && sidebarOverlay) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
            document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
        });
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    // ==================== REPORT MODAL ====================
    const reportModal = document.getElementById('reportModal');
    const btnGetReport = document.getElementById('btnGetReport');
    const modalClose = document.getElementById('modalClose');
    const reportForm = document.getElementById('reportForm');
    const reportSuccess = document.getElementById('reportSuccess');
    const btnCloseSuccess = document.getElementById('btnCloseSuccess');
    const btnSubmitText = document.getElementById('btnSubmitText');
    const btnSubmitLoading = document.getElementById('btnSubmitLoading');

    if (btnGetReport) {
        btnGetReport.addEventListener('click', () => {
            reportModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    function closeModal() {
        reportModal.classList.remove('active');
        document.body.style.overflow = '';
        reportForm.classList.remove('hidden');
        reportSuccess.classList.add('hidden');
        reportForm.reset();
    }

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (btnCloseSuccess) btnCloseSuccess.addEventListener('click', closeModal);
    reportModal?.addEventListener('click', (e) => { if (e.target === reportModal) closeModal(); });

    // ==================== LEAD CAPTURE HELPERS ====================
    const KINMO_MESSENGER_URL = 'https://www.facebook.com/messages/t/kinmopwcorporation';

    // Short, sales-ready summary of the current computed result — used for chat prefills.
    function buildLeadMessage(results) {
        const r = results || window.solarCalcResults || {};
        const parts = ['Hi Kinmo PW! I used your Solar Feasibility Tool and would like a quote.'];
        if (r.systemCapacity) parts.push('System ~' + Number(r.systemCapacity).toFixed(2) + ' kWp ' + (r.type || ''));
        if (r.monthlyBill) parts.push('Bill ' + formatPHP(r.monthlyBill));
        if (r.monthlySavings) parts.push('Est. savings ' + formatPHP(r.monthlySavings) + '/mo');
        if (r.paybackYears) parts.push('Payback ' + Number(r.paybackYears).toFixed(1) + ' yrs');
        return parts.join(' — ');
    }

    // Keep a local record of captured leads so a network/email failure never loses one.
    function persistLeadLocally(customerInfo, results) {
        try {
            const r = results || {};
            const entry = {
                ts: new Date().toISOString(),
                name: customerInfo.name, email: customerInfo.email,
                phone: customerInfo.phone, location: customerInfo.location,
                systemCapacity: r.systemCapacity, type: r.type, scale: r.scale,
                monthlyBill: r.monthlyBill, monthlySavings: r.monthlySavings,
                estimatedSystemCost: r.estimatedSystemCost, paybackYears: r.paybackYears, roi: r.roi
            };
            const key = 'kinmo_solar_leads';
            const arr = JSON.parse(localStorage.getItem(key) || '[]');
            arr.push(entry);
            localStorage.setItem(key, JSON.stringify(arr.slice(-50)));
        } catch (e) { /* localStorage unavailable — non-fatal */ }
    }

    // Inject the computed result into every chat deep-link so sales opens with full context.
    function updateContactLinks() {
        const enc = encodeURIComponent(buildLeadMessage(window.solarCalcResults));
        document.querySelectorAll('[data-chat="messenger"]').forEach(a => { a.href = KINMO_MESSENGER_URL + '?text=' + enc; });
        document.querySelectorAll('[data-chat="whatsapp"]').forEach(a => { a.href = 'https://wa.me/639687269310?text=' + enc; });
        // Viber deep links don't reliably accept prefilled text — keep the plain contact link.
    }

    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const now = Date.now();
            if (now - lastSubmitTime < 5000) { alert('Please wait a moment before submitting again.'); return; }
            const honeypot = document.getElementById('website_url');
            if (honeypot && honeypot.value) return;
            lastSubmitTime = now;

            const customerInfo = {
                name: document.getElementById('customerName').value,
                email: document.getElementById('customerEmail').value,
                phone: document.getElementById('customerPhone').value,
                location: document.getElementById('customerLocation').value
            };

            btnSubmitText.classList.add('hidden');
            btnSubmitLoading.classList.remove('hidden');
            document.getElementById('btnSubmitReport').disabled = true;

            try {
                const results = window.solarCalcResults || {};
                const templateParams = {
                    to_name: customerInfo.name, to_email: customerInfo.email,
                    customer_phone: customerInfo.phone || 'Not provided',
                    customer_location: customerInfo.location || 'Not provided',
                    system_capacity: (results.systemCapacity || 0).toFixed(2) + ' kWp',
                    num_panels: results.numPanels || 0,
                    system_type: results.type || 'N/A',
                    project_scale: results.scale || 'N/A',
                    monthly_savings: formatPHP(results.monthlySavings || 0),
                    annual_savings: formatPHP(results.annualSavings || 0),
                    bill_offset: (results.billOffset || 0).toFixed(1) + '%',
                    system_cost: formatPHPRange(results.estimatedSystemCostLow || 0, results.estimatedSystemCostHigh || 0),
                    payback_years: (results.paybackYears || 0).toFixed(1),
                    roi: (results.roi || 0).toFixed(0) + '%',
                    battery_config: results.batteryConfig || 'None'
                };

                // Sales-notification params: same system spec + lead contact details + reply_to.
                const notifyParams = Object.assign({}, templateParams, {
                    to_email: EMAILJS_CONFIG.notifyEmail,
                    to_name: 'Kinmo Sales — new lead: ' + (customerInfo.name || 'Unknown'),
                    reply_to: customerInfo.email,
                    lead_name: customerInfo.name,
                    lead_email: customerInfo.email,
                    lead_phone: customerInfo.phone || 'Not provided',
                    lead_location: customerInfo.location || 'Not provided',
                    monthly_bill: formatPHP(results.monthlyBill || 0)
                });

                // Always keep a local copy so a failed send never loses the lead.
                persistLeadLocally(customerInfo, results);

                const emailReady = window.emailjs && EMAILJS_CONFIG.publicKey !== 'YOUR_PUBLIC_KEY';
                const notifyReady = emailReady && !!EMAILJS_CONFIG.notifyEmail;
                let delivered = false;

                if (emailReady) {
                    // 1) Notify Kinmo sales FIRST — this is the whole point of the tool.
                    if (notifyReady) {
                        try {
                            await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.notifyTemplateId, notifyParams);
                            delivered = true;
                        } catch (err) { console.error('Sales notification failed:', err); }
                    } else {
                        console.warn('notifyTemplateId not configured — sales will NOT be notified. See README.');
                    }
                    // 2) Send the customer their own copy of the report.
                    try {
                        await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.customerTemplateId, templateParams);
                        delivered = true;
                    } catch (err) { console.error('Customer report email failed:', err); }
                } else {
                    console.warn('EmailJS not configured. Lead saved locally only.');
                    console.log('Lead:', customerInfo.name, notifyParams);
                    delivered = true; // treat as handled in dev / unconfigured environments
                }

                if (delivered) {
                    reportForm.classList.add('hidden');
                    reportSuccess.classList.remove('hidden');
                } else {
                    // Total email failure — route the lead to sales via Messenger as a fallback.
                    const proceed = confirm('We had trouble sending your report by email. Tap OK to message the Kinmo team directly on Messenger with your details, or Cancel to try again.');
                    if (proceed) window.open(KINMO_MESSENGER_URL + '?text=' + encodeURIComponent(buildLeadMessage(results)), '_blank', 'noopener');
                }
            } catch (error) {
                console.error('Error sending report:', error);
                alert('Something went wrong. Please try again, or contact us on Messenger / Viber / WhatsApp below.');
            } finally {
                btnSubmitText.classList.remove('hidden');
                btnSubmitLoading.classList.add('hidden');
                document.getElementById('btnSubmitReport').disabled = false;
            }
        });
    }

    // ==================== SETUP WIZARD ====================
    const wizardModal = document.getElementById('wizardModal');
    const btnWizard = document.getElementById('btnWizard');
    const wizardClose = document.getElementById('wizardClose');
    const wizPrev = document.getElementById('wizPrev');
    const wizNext = document.getElementById('wizNext');
    const wizFinish = document.getElementById('wizFinish');
    const wizardSteps = document.querySelectorAll('.wizard-step');
    const wizardDots = document.querySelectorAll('.wizard-dot');
    const wizardProgressBar = document.getElementById('wizardProgressBar');
    const WIZ_TOTAL_STEPS = 5;
    let wizCurrentStep = 1;

    const wizardState = {
        projectScale: 'Residential',
        systemType: 'Grid-Tied',
        bill: 15000, rate: 13.5,
        area: 50, wattage: 620,
        solarTarget: 100, daytimeLoad: 40,
        backupHours: 4, enableNetMetering: false,
        region: 'metro_manila'
    };

    function openWizard() {
        if (!wizardModal) return;
        // Pre-fill from current calculator values
        wizardState.projectScale = elements.projectScale.value;
        wizardState.systemType = elements.systemType.value;
        wizardState.bill = parseFloat(elements.bill.value) || 15000;
        wizardState.rate = parseFloat(elements.rate.value) || 13.5;
        wizardState.region = (elements.region && elements.region.value) || 'metro_manila';
        wizardState.area = parseFloat(elements.area.value) || 50;
        wizardState.wattage = parseFloat(elements.wattage.value) || 620;
        wizardState.solarTarget = parseInt(elements.solarTarget.value) || 100;
        wizardState.daytimeLoad = parseInt(elements.daytimeLoad.value) || 40;
        wizardState.backupHours = parseInt(elements.backupHours.value) || 4;
        wizardState.enableNetMetering = elements.enableNetMetering.checked;

        // Populate wizard inputs
        const wizBill = document.getElementById('wizBill');
        const wizRate = document.getElementById('wizRate');
        const wizRegion = document.getElementById('wizRegion');
        const wizRoofType = document.getElementById('wizRoofType');
        const wizArea = document.getElementById('wizArea');
        const wizRecommendedArea = document.getElementById('wizRecommendedArea');
        const wizWattage = document.getElementById('wizWattage');
        const wizSolarTarget = document.getElementById('wizSolarTarget');
        const wizDaytimeLoad = document.getElementById('wizDaytimeLoad');
        const wizBackupHours = document.getElementById('wizBackupHours');
        const wizNetMetering = document.getElementById('wizNetMetering');

        // Update wizard roof type options based on scale
        if (wizRoofType) {
            wizRoofType.innerHTML = '<option value="custom">I know my area</option>';
            const opts = roofTypeAreas[wizardState.projectScale] || roofTypeAreas['Residential'];
            const labels = {
                bungalow: 'Bungalow', '2story': '2-Story House', townhouse: 'Townhouse', condo: 'Apartment / Condo',
                small_commercial: 'Small Office / Shop', medium_commercial: 'Medium Building', warehouse: 'Large Building / Warehouse',
                small_land: 'Open Land (Small)', large_land: 'Open Land (Large)'
            };
            Object.entries(opts).forEach(([key, sqm]) => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = (labels[key] || key) + ' (~' + sqm + ' sqm)';
                wizRoofType.appendChild(opt);
            });
            wizRoofType.value = elements.roofType.value;
            wizRoofType.addEventListener('change', () => {
                if (wizRoofType.value !== 'custom') {
                    const areaOpts = roofTypeAreas[wizardState.projectScale] || roofTypeAreas['Residential'];
                    if (areaOpts[wizRoofType.value] && wizArea) {
                        wizArea.value = areaOpts[wizRoofType.value];
                    }
                }
            });
        }

        if (wizBill) wizBill.value = wizardState.bill;
        if (wizRate) wizRate.value = wizardState.rate;
        if (wizRegion) wizRegion.value = wizardState.region || (elements.region ? elements.region.value : 'metro_manila');
        if (wizArea) wizArea.value = wizardState.area;
        if (wizWattage) wizWattage.value = wizardState.wattage;

        // Update wizard recommended area hint
        function updateWizRecommendedArea() {
            if (!wizRecommendedArea || !wizBill || !wizRate) return;
            const bill = Math.max(0, parseFloat(wizBill.value) || 0);
            const rate = Math.max(0.01, parseFloat(wizRate.value) || 1);
            const target = parseInt(wizSolarTarget ? wizSolarTarget.value : 100) || 100;
            const watt = Math.max(100, parseFloat(wizWattage ? wizWattage.value : 620) || 620);
            const type = wizardState.systemType;
            const psh = REGION_PSH[wizardState.region] || DEFAULT_PSH;
            const dailyKwh = (bill / rate) / DAYS_PER_MONTH;
            const targetDaily = dailyKwh * (target / 100);
            const designFactor = type === 'Off-Grid' ? OFFGRID_DESIGN_FACTOR : 1.0;
            const requiredKwp = (psh * EFFICIENCY > 0) ? (targetDaily / (psh * EFFICIENCY)) * designFactor : 0;
            let panels = Math.ceil((requiredKwp * 1000) / watt) || 0;
            panels = Math.ceil(panels / PANEL_ROUND_MULTIPLE) * PANEL_ROUND_MULTIPLE;
            const neededArea = panels * PANEL_SIZE_SQM;
            if (neededArea > 0) {
                wizRecommendedArea.textContent = 'Recommended: ~' + neededArea.toFixed(0) + ' sqm for ' + target + '% coverage';
            }
        }
        if (wizBill) wizBill.addEventListener('input', updateWizRecommendedArea);
        if (wizRate) wizRate.addEventListener('input', updateWizRecommendedArea);
        if (wizSolarTarget) wizSolarTarget.addEventListener('input', updateWizRecommendedArea);
        if (wizWattage) wizWattage.addEventListener('input', updateWizRecommendedArea);
        updateWizRecommendedArea();
        if (wizSolarTarget) wizSolarTarget.value = wizardState.solarTarget;
        if (wizDaytimeLoad) wizDaytimeLoad.value = wizardState.daytimeLoad;
        if (wizBackupHours) wizBackupHours.value = wizardState.backupHours;
        if (wizNetMetering) wizNetMetering.checked = wizardState.enableNetMetering;

        // Update wizard slider labels
        const wizSolarTargetVal = document.getElementById('wizSolarTargetVal');
        const wizDaytimeLoadVal = document.getElementById('wizDaytimeLoadVal');
        const wizBackupHoursVal = document.getElementById('wizBackupHoursVal');
        if (wizSolarTargetVal) wizSolarTargetVal.textContent = wizardState.solarTarget;
        if (wizDaytimeLoadVal) wizDaytimeLoadVal.textContent = wizardState.daytimeLoad;
        if (wizBackupHoursVal) wizBackupHoursVal.textContent = wizardState.backupHours;

        // Pre-select option buttons
        document.querySelectorAll('#wizStep1 .wizard-option').forEach(btn => {
            btn.classList.toggle('selected', btn.getAttribute('data-value') === wizardState.projectScale);
        });
        document.querySelectorAll('#wizStep2 .wizard-option').forEach(btn => {
            btn.classList.toggle('selected', btn.getAttribute('data-value') === wizardState.systemType);
        });

        wizCurrentStep = 1;
        goToWizStep(1);
        wizardModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeWizard() {
        if (!wizardModal) return;
        wizardModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function goToWizStep(n) {
        wizCurrentStep = n;
        wizardSteps.forEach((step, i) => { step.classList.toggle('active', i === n - 1); });
        wizardDots.forEach((dot, i) => {
            dot.classList.remove('active', 'completed');
            if (i < n - 1) dot.classList.add('completed');
            if (i === n - 1) dot.classList.add('active');
        });
        if (wizardProgressBar) wizardProgressBar.style.setProperty('--wizard-progress', ((n / WIZ_TOTAL_STEPS) * 100) + '%');
        if (wizPrev) wizPrev.disabled = n === 1;
        if (wizNext) wizNext.classList.toggle('hidden', n === WIZ_TOTAL_STEPS);
        if (wizFinish) wizFinish.classList.toggle('hidden', n !== WIZ_TOTAL_STEPS);

        // Final step: generate the summary
        if (n === WIZ_TOTAL_STEPS) {
            generateWizardSummary();
        }

        // Focus first interactive element
        const activeStep = document.getElementById('wizStep' + n);
        if (activeStep) {
            const focusable = activeStep.querySelector('button, input, select, [tabindex]');
            if (focusable) setTimeout(() => focusable.focus(), 100);
        }
    }

    function readWizardInputs() {
        const wizBill = document.getElementById('wizBill');
        const wizRate = document.getElementById('wizRate');
        const wizRoofType = document.getElementById('wizRoofType');
        const wizArea = document.getElementById('wizArea');
        const wizWattage = document.getElementById('wizWattage');
        const wizSolarTarget = document.getElementById('wizSolarTarget');
        const wizDaytimeLoad = document.getElementById('wizDaytimeLoad');
        const wizBackupHours = document.getElementById('wizBackupHours');
        const wizNetMetering = document.getElementById('wizNetMetering');
        const wizRegion = document.getElementById('wizRegion');

        if (wizBill) wizardState.bill = parseFloat(wizBill.value) || 15000;
        if (wizRate) wizardState.rate = parseFloat(wizRate.value) || 13.5;
        if (wizRegion) wizardState.region = wizRegion.value;
        if (wizRoofType) wizardState.roofType = wizRoofType.value;
        if (wizArea) wizardState.area = parseFloat(wizArea.value) || 50;
        if (wizWattage) wizardState.wattage = parseFloat(wizWattage.value) || 620;
        if (wizSolarTarget) wizardState.solarTarget = parseInt(wizSolarTarget.value) || 100;
        if (wizDaytimeLoad) wizardState.daytimeLoad = parseInt(wizDaytimeLoad.value) || 75;
        if (wizBackupHours) wizardState.backupHours = parseInt(wizBackupHours.value) || 4;
        if (wizNetMetering) wizardState.enableNetMetering = wizNetMetering.checked;
    }

    function generateWizardSummary() {
        readWizardInputs();
        const summaryEl = document.getElementById('wizardSummary');
        if (!summaryEl) return;

        const params = {
            scale: wizardState.projectScale,
            type: wizardState.systemType,
            bill: wizardState.bill,
            rate: wizardState.rate,
            solarTargetPct: wizardState.systemType === 'Off-Grid' ? 100 : wizardState.solarTarget,
            area: wizardState.area,
            wattage: wizardState.wattage,
            daytimeLoadPct: wizardState.daytimeLoad,
            backupHours: wizardState.backupHours,
            enableNetMetering: wizardState.enableNetMetering,
            genChargeRate: parseFloat(elements.genCharge.value) || 5.5,
            region: wizardState.region || 'metro_manila'
        };

        const r = computeSolar(params);

        summaryEl.innerHTML = `
            <div class="wizard-summary-grid">
                <div class="wizard-summary-item">
                    <span class="wizard-summary-label">Project</span>
                    <span class="wizard-summary-value">${wizardState.projectScale} / ${wizardState.systemType}</span>
                </div>
                <div class="wizard-summary-item">
                    <span class="wizard-summary-label">System Size</span>
                    <span class="wizard-summary-value">${r.displayKwp.toFixed(2)} kWp (${r.displayPanels} panels)</span>
                </div>
                <div class="wizard-summary-item">
                    <span class="wizard-summary-label">Est. Cost</span>
                    <span class="wizard-summary-value">${formatPHPRange(r.estimatedSystemCostLow, r.estimatedSystemCostHigh)}</span>
                </div>
                <div class="wizard-summary-item">
                    <span class="wizard-summary-label">Monthly Savings</span>
                    <span class="wizard-summary-value highlight-success">${formatPHP(r.effectiveMonthlySavings)}</span>
                </div>
                <div class="wizard-summary-item">
                    <span class="wizard-summary-label">Payback</span>
                    <span class="wizard-summary-value">${r.paybackYears > 0 ? r.paybackYears.toFixed(1) + ' years' : 'N/A'}</span>
                </div>
                <div class="wizard-summary-item">
                    <span class="wizard-summary-label">25-Year ROI</span>
                    <span class="wizard-summary-value highlight-success">${r.roi > 0 ? r.roi.toFixed(0) + '%' : 'N/A'}</span>
                </div>
            </div>
        `;
    }

    function finishWizard() {
        readWizardInputs();

        // Transfer values to main calculator
        elements.projectScale.value = wizardState.projectScale;
        elements.systemType.value = wizardState.systemType;
        elements.bill.value = wizardState.bill;
        elements.rate.value = wizardState.rate;
        if (elements.region && wizardState.region) elements.region.value = wizardState.region;
        elements.solarTarget.value = wizardState.solarTarget;
        updateRoofTypeOptions();
        if (wizardState.roofType) elements.roofType.value = wizardState.roofType;
        elements.area.value = wizardState.area;
        elements.wattage.value = wizardState.wattage;
        elements.daytimeLoad.value = wizardState.daytimeLoad;
        elements.backupHours.value = wizardState.backupHours;
        elements.enableNetMetering.checked = wizardState.enableNetMetering;

        // Update UI visibility based on wizard selections
        applyScaleVisibility(wizardState.projectScale);

        if (wizardState.systemType === 'Off-Grid') {
            elements.offGridInfo.classList.remove('hidden');
            elements.solarTarget.disabled = true;
            elements.solarTargetVal.disabled = true;
            elements.solarTarget.value = 100;
            elements.solarTargetVal.value = 100;
        } else {
            elements.offGridInfo.classList.add('hidden');
            elements.solarTarget.disabled = false;
            elements.solarTargetVal.disabled = false;
        }

        if (wizardState.systemType === 'Grid-Tied') {
            elements.batterySection.classList.add('hidden');
        } else {
            elements.batterySection.classList.remove('hidden');
        }

        if (wizardState.enableNetMetering) {
            elements.genChargeGroup.classList.remove('hidden');
        } else {
            elements.genChargeGroup.classList.add('hidden');
        }

        // Update slider visuals
        document.querySelectorAll('.sidebar input[type="range"]').forEach(updateRangeBackground);
        updateBatteryOptions();
        closeWizard();
        calculate();
        // Land the user on their results instead of dumping them at the top of the page.
        const roiSection = document.querySelector('.roi-section');
        if (roiSection) setTimeout(() => roiSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }

    // Wizard event listeners
    if (btnWizard) btnWizard.addEventListener('click', openWizard);
    if (wizardClose) wizardClose.addEventListener('click', closeWizard);
    if (wizardModal) wizardModal.addEventListener('click', (e) => { if (e.target === wizardModal) closeWizard(); });

    if (wizNext) {
        wizNext.addEventListener('click', () => {
            readWizardInputs();
            if (wizCurrentStep < WIZ_TOTAL_STEPS) goToWizStep(wizCurrentStep + 1);
        });
    }
    if (wizPrev) {
        wizPrev.addEventListener('click', () => {
            if (wizCurrentStep > 1) goToWizStep(wizCurrentStep - 1);
        });
    }
    if (wizFinish) wizFinish.addEventListener('click', finishWizard);

    // Wizard option buttons (steps 1-2)
    document.querySelectorAll('.wizard-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.getAttribute('data-field');
            const value = btn.getAttribute('data-value');
            if (field && value) {
                wizardState[field] = value;
                btn.closest('.wizard-options').querySelectorAll('.wizard-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                // Auto-advance after selection
                setTimeout(() => {
                    readWizardInputs();
                    if (wizCurrentStep < WIZ_TOTAL_STEPS) goToWizStep(wizCurrentStep + 1);
                }, 300);
            }
        });
    });

    // Wizard slider label sync
    ['wizSolarTarget', 'wizDaytimeLoad', 'wizBackupHours'].forEach(id => {
        const slider = document.getElementById(id);
        const labelEl = document.getElementById(id + 'Val');
        if (slider && labelEl) {
            slider.addEventListener('input', () => { labelEl.textContent = slider.value; });
        }
    });

    // Wizard keyboard: Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && wizardModal && wizardModal.classList.contains('active')) {
            closeWizard();
        }
    });

    // ==================== BILL UPLOAD (AI READER) ====================
    const billUploadModal = document.getElementById('billUploadModal');
    if (billUploadModal) {
        const billFileInput = document.getElementById('billFileInput');
        const billFileList = document.getElementById('billFileList');
        const billUploadStep = document.getElementById('billUploadStep');
        const billLoadingStep = document.getElementById('billLoadingStep');
        const billConfirmStep = document.getElementById('billConfirmStep');
        const billError = document.getElementById('billError');
        const btnExtractBill = document.getElementById('btnExtractBill');
        const billReadList = document.getElementById('billReadList');
        const billChartWrap = document.getElementById('billChartWrap');
        const billUsageChart = document.getElementById('billUsageChart');
        const billApplyBill = document.getElementById('billApplyBill');
        const billApplyRate = document.getElementById('billApplyRate');
        const btnApplyBill = document.getElementById('btnApplyBill');
        const btnBillBack = document.getElementById('btnBillBack');
        const billModalClose = document.getElementById('billModalClose');
        const MAX_BILL_FILES = 12;

        let billFiles = [];
        let readBills = [];
        let billUploadContext = 'sidebar';

        function showBillStep(step) {
            billUploadStep.classList.toggle('hidden', step !== 'upload');
            billLoadingStep.classList.toggle('hidden', step !== 'loading');
            billConfirmStep.classList.toggle('hidden', step !== 'confirm');
        }

        function openBillUpload(context) {
            billUploadContext = context || 'sidebar';
            billFiles = [];
            readBills = [];
            billFileInput.value = '';
            renderBillFileList();
            billError.classList.add('hidden');
            showBillStep('upload');
            billUploadModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeBillUpload() {
            billUploadModal.classList.remove('active');
            // Keep scroll locked if the wizard is still open underneath.
            const wiz = document.getElementById('wizardModal');
            if (!wiz || !wiz.classList.contains('active')) document.body.style.overflow = '';
        }

        function renderBillFileList() {
            billFileList.innerHTML = billFiles.map((f, i) =>
                `<div class="bill-file-item"><span class="bill-file-name">${escapeHtml(f.name)}</span>` +
                `<button type="button" class="bill-file-remove" data-idx="${i}" aria-label="Remove file">&times;</button></div>`
            ).join('');
            btnExtractBill.disabled = billFiles.length === 0;
        }

        function escapeHtml(s) {
            return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        billFileList.addEventListener('click', (e) => {
            const btn = e.target.closest('.bill-file-remove');
            if (!btn) return;
            billFiles.splice(parseInt(btn.getAttribute('data-idx'), 10), 1);
            renderBillFileList();
        });

        billFileInput.addEventListener('change', () => {
            billError.classList.add('hidden');
            const incoming = Array.from(billFileInput.files || []);
            const room = MAX_BILL_FILES - billFiles.length;
            if (incoming.length > room) {
                showBillError('You can upload up to 12 bills at a time — extra files were ignored.');
            }
            billFiles = billFiles.concat(incoming.slice(0, Math.max(0, room)));
            billFileInput.value = '';
            renderBillFileList();
        });

        function showBillError(msg) {
            billError.textContent = msg;
            billError.classList.remove('hidden');
        }

        // ---- image handling: downscale photos, pass PDFs through ----
        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(String(r.result).split(',')[1]);
                r.onerror = () => reject(new Error('read'));
                r.readAsDataURL(file);
            });
        }

        function downscaleImage(file, maxDim = 1600, quality = 0.8) {
            return new Promise((resolve, reject) => {
                const url = URL.createObjectURL(file);
                const img = new Image();
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                    const w = Math.max(1, Math.round(img.width * scale));
                    const h = Math.max(1, Math.round(img.height * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    try {
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        resolve({ mimeType: 'image/jpeg', data: dataUrl.split(',')[1] });
                    } catch (e) { reject(e); }
                };
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
                img.src = url;
            });
        }

        async function fileToPart(file) {
            if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
                return { mimeType: 'application/pdf', data: await fileToBase64(file) };
            }
            try {
                return await downscaleImage(file);
            } catch (e) {
                return { mimeType: file.type || 'image/jpeg', data: await fileToBase64(file) };
            }
        }

        async function extractBills() {
            if (billFiles.length === 0) return;
            billError.classList.add('hidden');
            showBillStep('loading');
            try {
                const parts = await Promise.all(billFiles.map(fileToPart));
                const totalChars = parts.reduce((s, p) => s + (p.data ? p.data.length : 0), 0);
                if (totalChars > 5_500_000) { // ~4MB of binary, under Vercel's ~4.5MB body limit
                    throw new Error('Those files are a bit large. Please upload fewer bills, or use photos instead of PDFs.');
                }
                const resp = await fetch('/api/extract-bill', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ files: parts })
                });
                let json = {};
                try { json = await resp.json(); } catch (e) { json = {}; }
                if (!resp.ok || !json.ok) {
                    throw new Error(json.error || 'Could not read the bill. Please enter your details manually.');
                }
                const bills = (json.bills || []).filter(Boolean);
                if (bills.length === 0) {
                    throw new Error('We could not read any bills from those files. Try clearer photos or enter details manually.');
                }
                renderConfirm(bills);
            } catch (err) {
                showBillStep('upload');
                showBillError(err.message || 'Something went wrong. Please enter your details manually.');
            }
        }

        function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

        function renderConfirm(bills) {
            readBills = bills.map(b => {
                const amount = num(b.totalAmountDue);
                const kwh = num(b.totalKwh);
                let rate = num(b.effectiveRate);
                if (rate <= 0 && amount > 0 && kwh > 0) rate = amount / kwh;
                return {
                    month: b.billingMonth || '',
                    amount, kwh, rate,
                    readable: b.readable !== false,
                    note: b.note || '',
                    history: Array.isArray(b.history) ? b.history : []
                };
            });

            billReadList.innerHTML = readBills.map((b, i) => {
                if (!b.readable && b.amount <= 0 && b.kwh <= 0) {
                    return `<div class="bill-read-item"><span class="bill-read-month">${escapeHtml(b.month || ('Bill ' + (i + 1)))}</span>` +
                        `<p class="bill-read-unreadable">Couldn't read this one${b.note ? ': ' + escapeHtml(b.note) : '.'} You can still type values manually below.</p></div>`;
                }
                return `<div class="bill-read-item">
                    <span class="bill-read-month">${escapeHtml(b.month || ('Bill ' + (i + 1)))}</span>
                    <div class="bill-read-fields">
                        <div class="bill-read-field"><label>Amount (₱)</label><input type="number" step="100" min="0" data-idx="${i}" data-key="amount" value="${Math.round(b.amount)}"></div>
                        <div class="bill-read-field"><label>kWh used</label><input type="number" step="1" min="0" data-idx="${i}" data-key="kwh" value="${Math.round(b.kwh)}"></div>
                    </div>
                    <div class="bill-read-rate" id="billRate${i}">${b.rate > 0 ? '≈ ₱' + b.rate.toFixed(2) + '/kWh' : ''}</div>
                    ${b.note ? '<div class="bill-read-unreadable">' + escapeHtml(b.note) + '</div>' : ''}
                </div>`;
            }).join('');

            recomputeSummary();
            drawUsageChart();
            showBillStep('confirm');
        }

        billReadList.addEventListener('input', (e) => {
            const input = e.target.closest('input[data-idx]');
            if (!input) return;
            const idx = parseInt(input.getAttribute('data-idx'), 10);
            const key = input.getAttribute('data-key');
            if (!readBills[idx]) return;
            readBills[idx][key] = num(input.value);
            const b = readBills[idx];
            b.rate = (b.amount > 0 && b.kwh > 0) ? b.amount / b.kwh : 0;
            const rateEl = document.getElementById('billRate' + idx);
            if (rateEl) rateEl.textContent = b.rate > 0 ? '≈ ₱' + b.rate.toFixed(2) + '/kWh' : '';
            recomputeSummary();
            drawUsageChart();
        });

        function recomputeSummary() {
            const valid = readBills.filter(b => b.amount > 0);
            const avgBill = valid.length ? valid.reduce((s, b) => s + b.amount, 0) / valid.length : 0;
            const ratesArr = readBills.filter(b => b.rate > 0).map(b => b.rate);
            const avgRate = ratesArr.length ? ratesArr.reduce((s, r) => s + r, 0) / ratesArr.length : 0;
            if (avgBill > 0) billApplyBill.value = Math.round(avgBill);
            if (avgRate > 0) billApplyRate.value = avgRate.toFixed(2);
        }

        function collectUsagePoints() {
            const points = [];
            const seen = new Map();
            readBills.forEach(b => {
                (b.history || []).forEach(h => {
                    const kwh = num(h.kwh);
                    if (h.month && kwh > 0) { seen.set(String(h.month), kwh); }
                });
            });
            readBills.forEach(b => {
                if (b.month && b.kwh > 0) seen.set(String(b.month), b.kwh);
            });
            for (const [month, kwh] of seen.entries()) points.push({ month, kwh });
            return points;
        }

        function drawUsageChart() {
            const points = collectUsagePoints();
            if (points.length < 2) { billChartWrap.classList.add('hidden'); return; }
            billChartWrap.classList.remove('hidden');

            const dpr = window.devicePixelRatio || 1;
            const cssW = billUsageChart.clientWidth || 380;
            const cssH = 140;
            billUsageChart.width = cssW * dpr;
            billUsageChart.height = cssH * dpr;
            const ctx = billUsageChart.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, cssW, cssH);

            const styles = getComputedStyle(document.documentElement);
            const primary = styles.getPropertyValue('--primary').trim() || '#3b82f6';
            const muted = styles.getPropertyValue('--text-muted').trim() || '#94a3b8';

            const padL = 8, padR = 8, padT = 16, padB = 26;
            const chartW = cssW - padL - padR;
            const chartH = cssH - padT - padB;
            const maxKwh = Math.max.apply(null, points.map(p => p.kwh)) || 1;
            const n = points.length;
            const gap = 6;
            const barW = Math.max(6, (chartW - gap * (n - 1)) / n);

            points.forEach((p, i) => {
                const x = padL + i * (barW + gap);
                const h = (p.kwh / maxKwh) * chartH;
                const y = padT + chartH - h;
                ctx.fillStyle = primary;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(x, y, barW, h, 3); else ctx.rect(x, y, barW, h);
                ctx.fill();
                // value
                ctx.fillStyle = muted;
                ctx.font = '600 8px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(Math.round(p.kwh), x + barW / 2, y - 3);
                // month label (short)
                const label = String(p.month).slice(0, 3);
                ctx.fillText(label, x + barW / 2, cssH - 8);
            });
        }

        function applyBill() {
            const bill = num(billApplyBill.value);
            const rate = num(billApplyRate.value);
            if (bill > 0) elements.bill.value = Math.round(bill);
            if (rate > 0) elements.rate.value = (Math.round(rate * 100) / 100);

            if (billUploadContext === 'wizard') {
                const wb = document.getElementById('wizBill');
                const wr = document.getElementById('wizRate');
                if (wb && bill > 0) wb.value = Math.round(bill);
                if (wr && rate > 0) wr.value = (Math.round(rate * 100) / 100);
                if (typeof wizardState === 'object') {
                    if (bill > 0) wizardState.bill = Math.round(bill);
                    if (rate > 0) wizardState.rate = Math.round(rate * 100) / 100;
                }
            }

            if (typeof dismissSampleHint === 'function') dismissSampleHint();
            closeBillUpload();
            calculate();
        }

        btnExtractBill.addEventListener('click', extractBills);
        btnApplyBill.addEventListener('click', applyBill);
        btnBillBack.addEventListener('click', () => { showBillStep('upload'); });
        billModalClose.addEventListener('click', closeBillUpload);
        billUploadModal.addEventListener('click', (e) => { if (e.target === billUploadModal) closeBillUpload(); });
        window.addEventListener('resize', () => { if (!billChartWrap.classList.contains('hidden')) drawUsageChart(); });

        const btnUploadBillSidebar = document.getElementById('btnUploadBillSidebar');
        const btnUploadBillWizard = document.getElementById('btnUploadBillWizard');
        if (btnUploadBillSidebar) btnUploadBillSidebar.addEventListener('click', () => openBillUpload('sidebar'));
        if (btnUploadBillWizard) btnUploadBillWizard.addEventListener('click', () => openBillUpload('wizard'));
    }

    // ==================== INITIALIZE SAVINGS CHART ====================
    const savingsCanvas = document.getElementById('savingsChart');
    const savingsChart = savingsCanvas ? new SavingsChart(savingsCanvas) : null;

    // ==================== INITIALIZATION ====================
    const loadedFromURL = loadFromURL();
    const loadedFromStorage = loadedFromURL ? false : loadFromLocalStorage();
    const isSampleScenario = !loadedFromURL && !loadedFromStorage;

    // Fresh visit: preload the sample scenario's roof/area so results are non-zero.
    if (isSampleScenario) {
        elements.roofType.value = '2story';
        elements.area.value = '50';
    }

    const initScale = elements.projectScale.value;
    applyScaleVisibility(initScale);

    const initType = elements.systemType.value;
    if (initType === 'Off-Grid') {
        elements.offGridInfo.classList.remove('hidden');
        elements.solarTarget.disabled = true;
        elements.solarTarget.value = 100;
    }
    if (initType !== 'Grid-Tied') {
        elements.batterySection.classList.remove('hidden');
    }
    if (elements.enableNetMetering.checked) {
        elements.genChargeGroup.classList.remove('hidden');
    }

    shiftOptions.forEach(opt => {
        opt.classList.remove('active');
        opt.setAttribute('aria-checked', 'false');
        if (parseInt(opt.getAttribute('data-shift')) === currentShift) {
            opt.classList.add('active');
            opt.setAttribute('aria-checked', 'true');
        }
    });

    document.querySelectorAll('.sidebar input[type="range"]').forEach(updateRangeBackground);
    updateBatteryOptions();
    calculate();

    // ==================== SAMPLE SCENARIO HINT + WIZARD-FIRST ENTRY ====================
    const sampleHint = document.getElementById('sampleHint');

    function dismissSampleHint() {
        if (sampleHint && !sampleHint.classList.contains('hidden')) {
            sampleHint.classList.add('hidden');
        }
    }

    if (isSampleScenario && sampleHint) {
        sampleHint.classList.remove('hidden');
        // Hide the hint as soon as the user edits anything (real interactions dispatch
        // input/change/click; our programmatic updates do not).
        const sidebarContent = document.querySelector('.sidebar-content');
        ['input', 'change'].forEach(ev => {
            if (sidebarContent) sidebarContent.addEventListener(ev, dismissSampleHint);
            if (wizardModal) wizardModal.addEventListener(ev, dismissSampleHint);
        });
        document.querySelectorAll('.wizard-option').forEach(btn => btn.addEventListener('click', dismissSampleHint));
    }

    // First visit: the pre-filled sample results render immediately so the visitor sees value
    // in the first few seconds. The Quick Setup Wizard is an explicit opt-in (the hero button)
    // rather than an interruption that fires before any number is on screen.

    // Shared link: restore inputs AND land the user on the results/analysis view.
    if (loadedFromURL) {
        const target = document.querySelector('.roi-section');
        if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    }
});
