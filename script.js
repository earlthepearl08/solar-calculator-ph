document.addEventListener('DOMContentLoaded', () => {
    // ==================== EMAILJS CONFIGURATION ====================
    const EMAILJS_CONFIG = {
        publicKey: '4b7a3sQV-LmDcToos',
        serviceId: 'service_sx1yj4d',
        customerTemplateId: 'template_4ogepjc',
        notifyTemplateId: 'template_4ogepjc'
    };

    // Initialize EmailJS
    if (window.emailjs && EMAILJS_CONFIG.publicKey !== 'YOUR_PUBLIC_KEY') {
        emailjs.init(EMAILJS_CONFIG.publicKey);
    }

    // ==================== CONSTANTS ====================
    const PSH = 4.0;
    const EFFICIENCY = 0.80;
    const PANEL_SIZE_SQM = 3.0;
    const SYSTEM_LIFESPAN_YEARS = 15;
    const DAYS_PER_MONTH = 30;
    const OFFGRID_DESIGN_FACTOR = 1.25;
    const BATTERY_DOD = 0.9;
    const PANEL_ROUND_MULTIPLE = 2;
    const DEBOUNCE_MS = 150;

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
            const years = [];
            for (let y = 0; y <= SYSTEM_LIFESPAN_YEARS; y++) {
                years.push({
                    year: y,
                    cumulativeSavings: results.annualSavings * y,
                    systemCost: results.estimatedSystemCost
                });
            }
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
            for (let yr = 0; yr <= xMax; yr += 3) {
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
        bill: '15000',
        rate: '13.5',
        solarTarget: '100',
        area: '50',
        wattage: '620',
        daytimeLoad: '75',
        backupHours: '4',
        enableNetMetering: false,
        genCharge: '5.5'
    };

    // ==================== COST CALCULATION ====================
    function getCostPerKwp(scale, capacityKwp) {
        if (scale === 'Residential') {
            return 65000;
        } else if (scale === 'C&I') {
            return capacityKwp <= 100 ? 60000 : 57000;
        }
        return 50000;
    }

    function getBatteryCostPerKwh(scale) {
        if (scale === 'Residential') return 12500;
        if (scale === 'C&I') return 12000;
        return 11500; // Utility Scale
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
        const { scale, type, bill, rate, solarTargetPct, area, wattage, daytimeLoadPct, backupHours, enableNetMetering, genChargeRate } = params;

        const monthlyKwh = rate > 0 ? bill / rate : 0;
        const dailyKwh = monthlyKwh / DAYS_PER_MONTH;
        const targetDailySolarKwh = dailyKwh * (solarTargetPct / 100);

        const designFactor = type === 'Off-Grid' ? OFFGRID_DESIGN_FACTOR : 1.0;
        const requiredKwp = (PSH * EFFICIENCY > 0) ? (targetDailySolarKwh / (PSH * EFFICIENCY)) * designFactor : 0;

        let numPanelsRequired = Math.ceil((requiredKwp * 1000) / wattage) || 0;
        numPanelsRequired = Math.ceil(numPanelsRequired / PANEL_ROUND_MULTIPLE) * PANEL_ROUND_MULTIPLE;

        const totalPanelsPossible = Math.floor(area / PANEL_SIZE_SQM) || 0;
        const cappedPanelsPossible = Math.floor(totalPanelsPossible / PANEL_ROUND_MULTIPLE) * PANEL_ROUND_MULTIPLE;

        const displayPanels = Math.min(numPanelsRequired, cappedPanelsPossible);
        const displayKwp = (displayPanels * wattage) / 1000;
        const displayArea = displayPanels * PANEL_SIZE_SQM;

        const effectiveDailySolarKwh = displayKwp * PSH * EFFICIENCY;
        const daytimeLoadKwh = dailyKwh * (daytimeLoadPct / 100);
        const nighttimeLoadKwh = dailyKwh - daytimeLoadKwh;

        const directConsumedKwh = Math.min(effectiveDailySolarKwh, daytimeLoadKwh);
        const surplusSolarKwh = Math.max(0, effectiveDailySolarKwh - daytimeLoadKwh);

        const avgHourlyLoad = dailyKwh / 24;
        const backupStorageNeeded = avgHourlyLoad * backupHours;

        let optimalBattery;
        if (type === 'Hybrid' || type === 'Off-Grid') {
            optimalBattery = findOptimalBattery(backupStorageNeeded, scale);
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

        const costPerKwp = getCostPerKwp(scale, displayKwp);
        const solarCost = displayKwp * costPerKwp;
        const batteryCost = (type !== 'Grid-Tied' && batteryCapacityTotal > 0)
            ? batteryCapacityTotal * getBatteryCostPerKwh(scale) : 0;
        const estimatedSystemCost = solarCost + batteryCost;
        const annualSavings = c1MonthlySavings * 12;
        const paybackYears = annualSavings > 0 ? estimatedSystemCost / annualSavings : 0;
        const totalLifetimeSavings = annualSavings * SYSTEM_LIFESPAN_YEARS;
        const roi = estimatedSystemCost > 0 ? ((totalLifetimeSavings - estimatedSystemCost) / estimatedSystemCost * 100) : 0;

        const isSpaceLimited = numPanelsRequired > cappedPanelsPossible;
        const batteryConfig = type !== 'Grid-Tied' ? numBatt + 'x ' + batteryUnitLabel + ' (' + batteryCapacityTotal.toFixed(1) + ' kWh)' : 'None';

        return {
            displayKwp, displayPanels, displayArea, monthlyKwh, dailyKwh,
            effectiveDailySolarKwh, directConsumedKwh, surplusSolarKwh,
            batteryCapacityTotal, numBatt, batteryUnitLabel, usableBatteryKwh, batteryShiftedKwh,
            c1Title, c1Desc, c1DailySavingsKwh, c1MonthlySavings, c1Offset, residualSurplusKwh,
            c2MonthlySavings, c2Offset,
            solarCost, batteryCost, estimatedSystemCost, costPerKwp, paybackYears, roi, annualSavings, totalLifetimeSavings,
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

        let daytimeLoadPct;
        if (scale === 'Residential') {
            daytimeLoadPct = parseInt(elements.daytimeLoad.value);
        } else {
            const shiftToDaytimeMap = { 1: 85, 2: 55, 3: 40 };
            daytimeLoadPct = shiftToDaytimeMap[currentShift] || 55;
        }

        const backupHours = parseInt(elements.backupHours.value);
        const enableNetMetering = elements.enableNetMetering.checked;
        const genChargeRate = Math.max(0, parseFloat(elements.genCharge.value) || 0);

        // Build params for pure computation
        const params = { scale, type, bill, rate, solarTargetPct, area, wattage, daytimeLoadPct, backupHours, enableNetMetering, genChargeRate };
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
        if (elements.resSystemCost) elements.resSystemCost.textContent = formatPHPShort(r.estimatedSystemCost);
        if (elements.resPayback) elements.resPayback.textContent = r.paybackYears > 0 ? r.paybackYears.toFixed(1) + " years" : "N/A";
        if (elements.resROI) elements.resROI.textContent = r.roi > 0 ? r.roi.toFixed(0) + "%" : "N/A";

        // Hide cost breakdown — show lump sum only
        const breakdownEl = document.getElementById('resCostBreakdown');
        if (breakdownEl) breakdownEl.classList.add('hidden');

        // Store results for report
        window.solarCalcResults = {
            scale, type,
            systemCapacity: r.displayKwp,
            numPanels: r.displayPanels,
            areaUsed: r.displayArea,
            monthlyBill: bill, rate,
            monthlyGeneration: r.effectiveDailySolarKwh * DAYS_PER_MONTH,
            monthlySavings: r.c1MonthlySavings,
            annualSavings: r.annualSavings,
            billOffset: Math.min(r.c1Offset, 100),
            estimatedSystemCost: r.estimatedSystemCost, costPerKwp: r.costPerKwp,
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

        // Update Phase 6 features
        if (savingsChart) savingsChart.update({ annualSavings: r.annualSavings, estimatedSystemCost: r.estimatedSystemCost, paybackYears: r.paybackYears });
        updateComparisonTable(params);
        updateSensitivityAnalysis(params);
        updateRecommendedArea();

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
            { label: 'Monthly Savings', fn: r => formatPHP(r.c1MonthlySavings) },
            { label: 'Payback Period', fn: r => r.paybackYears > 0 ? r.paybackYears.toFixed(1) + ' years' : 'N/A' },
            { label: '15-Year ROI', fn: r => r.roi > 0 ? r.roi.toFixed(0) + '%' : 'N/A' },
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
                    <td>${formatPHPShort(res.c1MonthlySavings)}</td>
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
            roofType: elements.roofType.value
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
        const map = { scale: 'projectScale', type: 'systemType', bill: 'bill', rate: 'rate', target: 'solarTarget', area: 'area', watt: 'wattage', daytime: 'daytimeLoad', backup: 'backupHours', gencharge: 'genCharge' };
        let found = false;
        for (const [param, elKey] of Object.entries(map)) {
            const val = params.get(param);
            if (val && elements[elKey]) { elements[elKey].value = val; found = true; }
        }
        if (params.get('netmeter') === '1') { elements.enableNetMetering.checked = true; found = true; }
        return found;
    }

    function getShareURL() {
        const params = new URLSearchParams();
        params.set('scale', elements.projectScale.value);
        params.set('type', elements.systemType.value);
        params.set('bill', elements.bill.value);
        params.set('rate', elements.rate.value);
        params.set('target', elements.solarTarget.value);
        params.set('area', elements.area.value);
        params.set('watt', elements.wattage.value);
        params.set('daytime', elements.daytimeLoad.value);
        params.set('backup', elements.backupHours.value);
        if (elements.enableNetMetering.checked) params.set('netmeter', '1');
        params.set('gencharge', elements.genCharge.value);
        return window.location.origin + window.location.pathname + '?' + params.toString();
    }

    // ==================== EVENT LISTENERS ====================
    const immediateElements = [elements.projectScale, elements.systemType, elements.enableNetMetering];
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
        const scale = elements.projectScale.value;
        if (scale === 'Residential') {
            elements.daytimeLoadGroup.classList.remove('hidden');
            elements.shiftGroup.classList.add('hidden');
        } else {
            elements.daytimeLoadGroup.classList.add('hidden');
            elements.shiftGroup.classList.remove('hidden');
        }
        updateBatteryOptions();
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
        const dailyKwh = (bill / rate) / DAYS_PER_MONTH;
        const targetDaily = dailyKwh * (solarTargetPct / 100);
        const designFactor = type === 'Off-Grid' ? OFFGRID_DESIGN_FACTOR : 1.0;
        const requiredKwp = (PSH * EFFICIENCY > 0) ? (targetDaily / (PSH * EFFICIENCY)) * designFactor : 0;
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
            elements.daytimeLoadGroup.classList.remove('hidden');
            elements.shiftGroup.classList.add('hidden');
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
                    system_cost: formatPHP(results.estimatedSystemCost || 0),
                    payback_years: (results.paybackYears || 0).toFixed(1),
                    roi: (results.roi || 0).toFixed(0) + '%',
                    battery_config: results.batteryConfig || 'None'
                };

                if (window.emailjs && EMAILJS_CONFIG.publicKey !== 'YOUR_PUBLIC_KEY') {
                    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.customerTemplateId, templateParams);
                } else {
                    console.warn('EmailJS not configured. Report data logged to console.');
                    console.log('Report for:', customerInfo.name, templateParams);
                }
                reportForm.classList.add('hidden');
                reportSuccess.classList.remove('hidden');
            } catch (error) {
                console.error('Error sending report:', error);
                alert('Error sending report. Please try again or contact support.');
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
    const WIZ_TOTAL_STEPS = 6;
    let wizCurrentStep = 1;

    const wizardState = {
        projectScale: 'Residential',
        systemType: 'Grid-Tied',
        bill: 15000, rate: 13.5,
        area: 50, wattage: 620,
        solarTarget: 100, daytimeLoad: 75,
        backupHours: 4, enableNetMetering: false
    };

    function openWizard() {
        if (!wizardModal) return;
        // Pre-fill from current calculator values
        wizardState.projectScale = elements.projectScale.value;
        wizardState.systemType = elements.systemType.value;
        wizardState.bill = parseFloat(elements.bill.value) || 15000;
        wizardState.rate = parseFloat(elements.rate.value) || 13.5;
        wizardState.area = parseFloat(elements.area.value) || 50;
        wizardState.wattage = parseFloat(elements.wattage.value) || 620;
        wizardState.solarTarget = parseInt(elements.solarTarget.value) || 100;
        wizardState.daytimeLoad = parseInt(elements.daytimeLoad.value) || 75;
        wizardState.backupHours = parseInt(elements.backupHours.value) || 4;
        wizardState.enableNetMetering = elements.enableNetMetering.checked;

        // Populate wizard inputs
        const wizBill = document.getElementById('wizBill');
        const wizRate = document.getElementById('wizRate');
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
            const dailyKwh = (bill / rate) / DAYS_PER_MONTH;
            const targetDaily = dailyKwh * (target / 100);
            const designFactor = type === 'Off-Grid' ? OFFGRID_DESIGN_FACTOR : 1.0;
            const requiredKwp = (PSH * EFFICIENCY > 0) ? (targetDaily / (PSH * EFFICIENCY)) * designFactor : 0;
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

        // Step 5: Show/hide battery group based on system type
        if (n === 5) {
            const battGroup = document.getElementById('wizBatteryGroup');
            if (battGroup) battGroup.classList.toggle('hidden', wizardState.systemType === 'Grid-Tied');
            const wizST = document.getElementById('wizSolarTarget');
            if (wizardState.systemType === 'Off-Grid' && wizST) {
                wizST.value = 100;
                wizST.disabled = true;
                const wizSTV = document.getElementById('wizSolarTargetVal');
                if (wizSTV) wizSTV.textContent = '100';
                wizardState.solarTarget = 100;
            } else if (wizST) {
                wizST.disabled = false;
            }
        }

        // Step 6: Generate summary
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

        if (wizBill) wizardState.bill = parseFloat(wizBill.value) || 15000;
        if (wizRate) wizardState.rate = parseFloat(wizRate.value) || 13.5;
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
            genChargeRate: parseFloat(elements.genCharge.value) || 5.5
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
                    <span class="wizard-summary-value">${formatPHPShort(r.estimatedSystemCost)}</span>
                </div>
                <div class="wizard-summary-item">
                    <span class="wizard-summary-label">Monthly Savings</span>
                    <span class="wizard-summary-value highlight-success">${formatPHP(r.c1MonthlySavings)}</span>
                </div>
                <div class="wizard-summary-item">
                    <span class="wizard-summary-label">Payback</span>
                    <span class="wizard-summary-value">${r.paybackYears > 0 ? r.paybackYears.toFixed(1) + ' years' : 'N/A'}</span>
                </div>
                <div class="wizard-summary-item">
                    <span class="wizard-summary-label">15-Year ROI</span>
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
        elements.solarTarget.value = wizardState.solarTarget;
        updateRoofTypeOptions();
        if (wizardState.roofType) elements.roofType.value = wizardState.roofType;
        elements.area.value = wizardState.area;
        elements.wattage.value = wizardState.wattage;
        elements.daytimeLoad.value = wizardState.daytimeLoad;
        elements.backupHours.value = wizardState.backupHours;
        elements.enableNetMetering.checked = wizardState.enableNetMetering;

        // Update UI visibility based on wizard selections
        if (wizardState.projectScale === 'Residential') {
            elements.daytimeLoadGroup.classList.remove('hidden');
            elements.shiftGroup.classList.add('hidden');
        } else {
            elements.daytimeLoadGroup.classList.add('hidden');
            elements.shiftGroup.classList.remove('hidden');
        }

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

    // ==================== INITIALIZE SAVINGS CHART ====================
    const savingsCanvas = document.getElementById('savingsChart');
    const savingsChart = savingsCanvas ? new SavingsChart(savingsCanvas) : null;

    // ==================== INITIALIZATION ====================
    const loadedFromURL = loadFromURL();
    if (!loadedFromURL) loadFromLocalStorage();

    const initScale = elements.projectScale.value;
    if (initScale !== 'Residential') {
        elements.daytimeLoadGroup.classList.add('hidden');
        elements.shiftGroup.classList.remove('hidden');
    }

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
});
