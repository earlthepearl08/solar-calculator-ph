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
    // Debounce to prevent rapid recalculations
    function debounce(fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    // Animation cancellation map
    const activeAnimations = new Map();

    function animateValue(element, start, end, duration = 800, suffix = '') {
        if (!element) return;

        // Cancel any running animation on this element
        if (activeAnimations.has(element)) {
            cancelAnimationFrame(activeAnimations.get(element));
        }

        // Respect reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            element.textContent = end.toFixed(end < 10 ? 2 : 1) + suffix;
            return;
        }

        const startTime = performance.now();
        const range = end - start;

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = start + (range * easeOutQuart);

            element.textContent = current.toFixed(end < 10 ? 2 : 1) + suffix;
            element.classList.add('updating');

            if (progress < 1) {
                activeAnimations.set(element, requestAnimationFrame(update));
            } else {
                activeAnimations.delete(element);
                setTimeout(() => element.classList.remove('updating'), 300);
            }
        }

        activeAnimations.set(element, requestAnimationFrame(update));
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

    // Clamp a value within min/max
    function clampInput(el) {
        const val = parseFloat(el.value);
        const min = parseFloat(el.min);
        const max = parseFloat(el.max);
        if (!isNaN(min) && val < min) el.value = min;
        if (!isNaN(max) && val > max) el.value = max;
    }

    // ==================== DOM ELEMENTS ====================
    const elements = {
        projectScale: document.getElementById('projectScale'),
        systemType: document.getElementById('systemType'),
        bill: document.getElementById('bill'),
        rate: document.getElementById('rate'),
        solarTarget: document.getElementById('solarTarget'),
        solarTargetVal: document.getElementById('solarTargetVal'),
        area: document.getElementById('area'),
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

    // Cached NodeLists
    const shiftOptions = document.querySelectorAll('.shift-option');
    const clearButtons = document.querySelectorAll('.clear-input');

    let currentShift = 1;
    let lastSubmitTime = 0;

    const batteryOptionsMap = {
        'Residential': { '5kWh': 5, '10kWh': 10, '15kWh': 15 },
        'C&I': { '100kWh': 100, '215kWh': 215, '1MWh': 1000 },
        'Utility Scale': { '215kWh': 215, '1MWh': 1000 }
    };

    // Default input values for reset
    const DEFAULTS = {
        projectScale: 'Residential',
        systemType: 'Grid-Tied',
        bill: '15000',
        rate: '13.5',
        solarTarget: '100',
        area: '50',
        wattage: '620',
        daytimeLoad: '40',
        backupHours: '4',
        enableNetMetering: false,
        genCharge: '5.5'
    };

    // ==================== COST CALCULATION ====================
    // Residential: ₱65,000/kWp
    // C&I 21-100kWp: ₱60,000/kWp
    // C&I 100-300kWp: ₱57,000/kWp
    // Utility Scale (300kWp+): ₱50,000/kWp
    function getCostPerKwp(scale, capacityKwp) {
        if (scale === 'Residential') {
            return 65000;
        } else if (scale === 'C&I') {
            return capacityKwp <= 100 ? 60000 : 57000;
        }
        return 50000;
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
        const options = batteryOptionsMap[scale];
        elements.batteryUnit.innerHTML = '';
        Object.keys(options).forEach(label => {
            const opt = document.createElement('option');
            opt.value = options[label];
            opt.textContent = label;
            elements.batteryUnit.appendChild(opt);
        });
        elements.batteryUnit.selectedIndex = elements.batteryUnit.options.length - 1;
    }

    // ==================== MAIN CALCULATION ====================
    function calculate() {
        const scale = elements.projectScale.value;
        const type = elements.systemType.value;
        const bill = Math.max(0, parseFloat(elements.bill.value) || 0);
        const rate = Math.max(0, parseFloat(elements.rate.value) || 0);
        const solarTargetPct = type === 'Off-Grid' ? 100 : parseInt(elements.solarTarget.value);
        const area = Math.max(0, parseFloat(elements.area.value) || 0);
        const wattage = Math.max(100, parseFloat(elements.wattage.value) || 620);

        // Calculate daytime load percentage based on project scale
        let daytimeLoadPct;
        if (scale === 'Residential') {
            daytimeLoadPct = parseInt(elements.daytimeLoad.value);
        } else {
            const shiftToDaytimeMap = {
                1: 85,  // 1 shift (8h): peak daytime coverage + spillover
                2: 55,  // 2 shifts (16h): moderate daytime coverage
                3: 40   // 3 shifts (24h): 24/7 with extended generation
            };
            daytimeLoadPct = shiftToDaytimeMap[currentShift] || 55;
        }

        const backupHours = parseInt(elements.backupHours.value);
        const enableNetMetering = elements.enableNetMetering.checked;
        const genChargeRate = Math.max(0, parseFloat(elements.genCharge.value) || 0);

        // Update visual labels
        elements.displayProjectScale.textContent = scale + " Project";
        elements.solarTargetVal.textContent = solarTargetPct;
        elements.daytimeLoadVal.textContent = daytimeLoadPct;
        elements.backupHoursVal.textContent = backupHours;

        // Core solar calculations
        const monthlyKwh = rate > 0 ? bill / rate : 0;
        const dailyKwh = monthlyKwh / DAYS_PER_MONTH;
        const targetDailySolarKwh = dailyKwh * (solarTargetPct / 100);

        const designFactor = type === 'Off-Grid' ? OFFGRID_DESIGN_FACTOR : 1.0;
        const requiredKwp = (PSH * EFFICIENCY > 0) ? (targetDailySolarKwh / (PSH * EFFICIENCY)) * designFactor : 0;

        let numPanelsRequired = Math.ceil((requiredKwp * 1000) / wattage) || 0;
        numPanelsRequired = Math.ceil(numPanelsRequired / PANEL_ROUND_MULTIPLE) * PANEL_ROUND_MULTIPLE;

        const totalPanelsPossible = Math.floor(area / PANEL_SIZE_SQM) || 0;
        const cappedPanelsPossible = Math.floor(totalPanelsPossible / PANEL_ROUND_MULTIPLE) * PANEL_ROUND_MULTIPLE;

        // Final metrics
        const displayPanels = Math.min(numPanelsRequired, cappedPanelsPossible);
        const displayKwp = (displayPanels * wattage) / 1000;
        const displayArea = displayPanels * PANEL_SIZE_SQM;

        // Animate metric values
        const prevCapacity = parseFloat(elements.resCapacity.textContent) || 0;
        const prevPanels = parseFloat(elements.resPanels.textContent) || 0;
        const prevArea = parseFloat(elements.resArea.textContent) || 0;

        animateValue(elements.resCapacity, prevCapacity, displayKwp, 800, " kWp");
        animateValue(elements.resPanels, prevPanels, displayPanels, 800, "");
        animateValue(elements.resArea, prevArea, displayArea, 800, " m²");

        // Production details
        const effectiveDailySolarKwh = displayKwp * PSH * EFFICIENCY;
        const daytimeLoadKwh = dailyKwh * (daytimeLoadPct / 100);
        const nighttimeLoadKwh = dailyKwh - daytimeLoadKwh;

        const directConsumedKwh = Math.min(effectiveDailySolarKwh, daytimeLoadKwh);
        const surplusSolarKwh = Math.max(0, effectiveDailySolarKwh - daytimeLoadKwh);

        // Battery logic
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

        if (type === 'Grid-Tied') {
            elements.resStorageCard.classList.add('hidden');
        } else {
            elements.resStorageCard.classList.remove('hidden');
            const prevStorage = parseFloat(elements.resStorage.textContent) || 0;
            animateValue(elements.resStorage, prevStorage, batteryCapacityTotal, 800, " kWh");
        }

        // Scenario 1
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

        elements.sc1Title.textContent = c1Title;
        elements.sc1Desc.textContent = c1Desc;
        elements.sc1Monthly.textContent = formatPHP(c1MonthlySavings);
        elements.sc1Offset.textContent = Math.min(c1Offset, 100).toFixed(1) + "% Bill Offset";
        elements.sc1Yearly.textContent = "Est. " + formatPHP(c1MonthlySavings * 12).split('.')[0] + " / year";

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

            const c2GrossMonthly = (c1DailySavingsKwh * DAYS_PER_MONTH * rate) + (residualSurplusKwh * DAYS_PER_MONTH * genChargeRate);
            const c2MonthlySavings = Math.min(c2GrossMonthly, bill);
            const c2Offset = dailyKwh > 0 ? (effectiveDailySolarKwh / dailyKwh * 100) : 0;

            elements.sc2Monthly.textContent = formatPHP(c2MonthlySavings);
            elements.sc2Offset.textContent = Math.min(c2Offset, 100).toFixed(1) + "% Total Offset";
            elements.sc2Yearly.textContent = "Est. " + formatPHP(c2MonthlySavings * 12).split('.')[0] + " / year";
        }

        // ROI
        const costPerKwp = getCostPerKwp(scale, displayKwp);
        const estimatedSystemCost = displayKwp * costPerKwp;
        const annualSavings = c1MonthlySavings * 12;
        const paybackYears = annualSavings > 0 ? estimatedSystemCost / annualSavings : 0;
        const totalLifetimeSavings = annualSavings * SYSTEM_LIFESPAN_YEARS;
        const roi = estimatedSystemCost > 0 ? ((totalLifetimeSavings - estimatedSystemCost) / estimatedSystemCost * 100) : 0;

        if (elements.resSystemCost) {
            elements.resSystemCost.textContent = formatPHPShort(estimatedSystemCost);
        }
        if (elements.resPayback) {
            elements.resPayback.textContent = paybackYears > 0 ? paybackYears.toFixed(1) + " years" : "N/A";
        }
        if (elements.resROI) {
            elements.resROI.textContent = roi > 0 ? roi.toFixed(0) + "%" : "N/A";
        }

        // Store results for report
        window.solarCalcResults = {
            scale, type,
            systemCapacity: displayKwp,
            numPanels: displayPanels,
            areaUsed: displayArea,
            monthlyBill: bill, rate,
            monthlyGeneration: effectiveDailySolarKwh * DAYS_PER_MONTH,
            monthlySavings: c1MonthlySavings,
            annualSavings,
            billOffset: Math.min(c1Offset, 100),
            estimatedSystemCost, costPerKwp,
            paybackYears, roi,
            lifetimeSavings: totalLifetimeSavings,
            batteryConfig: type !== 'Grid-Tied' ? `${numBatt}x ${batteryUnitLabel}` : 'None'
        };

        // Energy flow details
        elements.detMonthlyGen.textContent = (effectiveDailySolarKwh * DAYS_PER_MONTH).toFixed(1) + " kWh";
        elements.detDirectCons.textContent = (directConsumedKwh * DAYS_PER_MONTH).toFixed(1) + " kWh";
        elements.detSurplus.textContent = (surplusSolarKwh * DAYS_PER_MONTH).toFixed(1) + " kWh";
        elements.detMonthlyReq.textContent = monthlyKwh.toFixed(1) + " kWh";

        // Battery assessment box (using CSS classes instead of inline styles)
        if (type === 'Grid-Tied') {
            elements.detConfigTitle.textContent = "Battery Recommendation";
            if (surplusSolarKwh > 0) {
                const suggestedBattery = findOptimalBattery(surplusSolarKwh, scale);
                elements.detConfigContent.innerHTML = `<p class="config-detail">Adding <strong>${suggestedBattery.numUnits}x ${suggestedBattery.label}</strong> (${suggestedBattery.totalKwh.toFixed(1)} kWh total) would capture surplus solar for nighttime use.</p>`;
            } else {
                elements.detConfigContent.innerHTML = `<p class="config-success">Your daytime load consumes all solar. Battery is optional for backup only.</p>`;
            }
        } else {
            elements.detConfigTitle.textContent = type + " Storage Setup";
            elements.detConfigContent.innerHTML = `
                <ul class="config-list">
                    <li>Target Backup: <strong>${backupHours} hours</strong></li>
                    <li>Total Battery Units: <strong>${numBatt}x ${batteryUnitLabel}</strong></li>
                    <li>Total Capacity: <strong>${batteryCapacityTotal.toFixed(1)} kWh</strong></li>
                </ul>
            `;
        }

        // Status alerts (using CSS classes)
        elements.statusAlerts.innerHTML = '';

        let actualCat = "";
        if (displayKwp <= 20) actualCat = "Residential";
        else if (displayKwp <= 300) actualCat = "C&I";
        else actualCat = "Utility Scale";

        if (scale !== actualCat) {
            const alert = document.createElement('div');
            alert.className = 'status-alert scale-alert';
            alert.innerHTML = `<strong>Note:</strong> System sized as <strong>${actualCat}</strong> (${displayKwp.toFixed(1)} kWp). Consider switching Project Scale to <strong>${actualCat}</strong> for optimized battery options and pricing.`;
            elements.statusAlerts.appendChild(alert);
        }

        if (numPanelsRequired > cappedPanelsPossible) {
            const warning = document.createElement('div');
            warning.className = 'status-alert space-warning';
            const offsetMax = dailyKwh > 0 ? (effectiveDailySolarKwh / dailyKwh * 100) : 0;
            warning.innerHTML = `<strong>Space limited:</strong> Your ${area} sqm area fits ${cappedPanelsPossible} panels (${offsetMax.toFixed(1)}% offset). To reach ${solarTargetPct}% target, try increasing area to <strong>${(numPanelsRequired * PANEL_SIZE_SQM).toFixed(0)} sqm</strong> or reducing your target.`;
            elements.statusAlerts.appendChild(warning);
        }

        // Save to localStorage
        saveToLocalStorage();
    }

    // Debounced version for input events
    const debouncedCalculate = debounce(calculate, DEBOUNCE_MS);

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
            currentShift: currentShift
        };
        try {
            localStorage.setItem('solarCalcState', JSON.stringify(state));
        } catch (e) { /* quota exceeded, ignore */ }
    }

    function loadFromLocalStorage() {
        try {
            const saved = JSON.parse(localStorage.getItem('solarCalcState'));
            if (!saved) return false;

            elements.projectScale.value = saved.projectScale || DEFAULTS.projectScale;
            elements.systemType.value = saved.systemType || DEFAULTS.systemType;
            elements.bill.value = saved.bill || DEFAULTS.bill;
            elements.rate.value = saved.rate || DEFAULTS.rate;
            elements.solarTarget.value = saved.solarTarget || DEFAULTS.solarTarget;
            elements.area.value = saved.area || DEFAULTS.area;
            elements.wattage.value = saved.wattage || DEFAULTS.wattage;
            elements.daytimeLoad.value = saved.daytimeLoad || DEFAULTS.daytimeLoad;
            elements.backupHours.value = saved.backupHours || DEFAULTS.backupHours;
            elements.enableNetMetering.checked = saved.enableNetMetering || false;
            elements.genCharge.value = saved.genCharge || DEFAULTS.genCharge;
            currentShift = saved.currentShift || 1;

            return true;
        } catch (e) {
            return false;
        }
    }

    function loadFromURL() {
        const params = new URLSearchParams(window.location.search);
        if (params.size === 0) return false;

        const mapping = {
            scale: 'projectScale', type: 'systemType', bill: 'bill',
            rate: 'rate', target: 'solarTarget', area: 'area',
            watt: 'wattage', daytime: 'daytimeLoad', backup: 'backupHours',
            netmeter: null, gencharge: 'genCharge'
        };

        let loaded = false;
        for (const [param, elKey] of Object.entries(mapping)) {
            const val = params.get(param);
            if (val === null) continue;
            loaded = true;
            if (param === 'netmeter') {
                elements.enableNetMetering.checked = val === '1';
            } else if (elements[elKey]) {
                elements[elKey].value = val;
            }
        }
        return loaded;
    }

    // ==================== SHARE URL ====================
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
    // Form elements — use debounced calculate for text inputs, immediate for selects/checkboxes
    const immediateElements = [elements.projectScale, elements.systemType, elements.enableNetMetering];
    const debouncedElements = [elements.bill, elements.rate, elements.area, elements.wattage, elements.genCharge];
    const rangeElements = [elements.solarTarget, elements.daytimeLoad, elements.backupHours];

    immediateElements.forEach(el => {
        el.addEventListener('change', calculate);
    });

    debouncedElements.forEach(el => {
        el.addEventListener('input', debouncedCalculate);
        el.addEventListener('change', calculate);
        el.addEventListener('blur', () => clampInput(el));
    });

    rangeElements.forEach(el => {
        el.addEventListener('input', calculate);
        el.addEventListener('change', calculate);
    });

    // Project scale toggle
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

    // System type toggle
    elements.systemType.addEventListener('change', (e) => {
        const type = e.target.value;
        if (type === 'Off-Grid') {
            elements.offGridInfo.classList.remove('hidden');
            elements.solarTarget.disabled = true;
            elements.solarTarget.value = 100;
            elements.solarTargetVal.textContent = 100;
            updateRangeBackground(elements.solarTarget);
        } else {
            elements.offGridInfo.classList.add('hidden');
            elements.solarTarget.disabled = false;
        }

        if (type === 'Grid-Tied') {
            elements.batterySection.classList.add('hidden');
        } else {
            elements.batterySection.classList.remove('hidden');
        }
    });

    // Net metering toggle
    elements.enableNetMetering.addEventListener('change', (e) => {
        if (e.target.checked) {
            elements.genChargeGroup.classList.remove('hidden');
        } else {
            elements.genChargeGroup.classList.add('hidden');
        }
    });

    // Clear buttons
    clearButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-target');
            if (elements[targetId]) {
                elements[targetId].value = '';
                calculate();
            }
        });
    });

    // Shift selector
    shiftOptions.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const shiftValue = parseInt(e.currentTarget.getAttribute('data-shift'));
            currentShift = shiftValue;
            shiftOptions.forEach(opt => {
                opt.classList.remove('active');
                opt.setAttribute('aria-checked', 'false');
            });
            e.currentTarget.classList.add('active');
            e.currentTarget.setAttribute('aria-checked', 'true');
            calculate();
        });

        // Keyboard support for shift buttons
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });
    });

    // Reset to defaults
    if (elements.btnReset) {
        elements.btnReset.addEventListener('click', () => {
            elements.projectScale.value = DEFAULTS.projectScale;
            elements.systemType.value = DEFAULTS.systemType;
            elements.bill.value = DEFAULTS.bill;
            elements.rate.value = DEFAULTS.rate;
            elements.solarTarget.value = DEFAULTS.solarTarget;
            elements.solarTarget.disabled = false;
            elements.area.value = DEFAULTS.area;
            elements.wattage.value = DEFAULTS.wattage;
            elements.daytimeLoad.value = DEFAULTS.daytimeLoad;
            elements.backupHours.value = DEFAULTS.backupHours;
            elements.enableNetMetering.checked = DEFAULTS.enableNetMetering;
            elements.genCharge.value = DEFAULTS.genCharge;
            currentShift = 1;

            // Reset UI visibility
            elements.daytimeLoadGroup.classList.remove('hidden');
            elements.shiftGroup.classList.add('hidden');
            elements.batterySection.classList.add('hidden');
            elements.offGridInfo.classList.add('hidden');
            elements.genChargeGroup.classList.add('hidden');

            shiftOptions.forEach(opt => {
                opt.classList.remove('active');
                opt.setAttribute('aria-checked', 'false');
            });
            if (shiftOptions[0]) {
                shiftOptions[0].classList.add('active');
                shiftOptions[0].setAttribute('aria-checked', 'true');
            }

            // Update slider visuals
            document.querySelectorAll('input[type="range"]').forEach(updateRangeBackground);

            updateBatteryOptions();
            calculate();
            localStorage.removeItem('solarCalcState');
        });
    }

    // Share button
    const btnShare = document.getElementById('btnShare');
    if (btnShare) {
        btnShare.addEventListener('click', async () => {
            const url = getShareURL();
            try {
                await navigator.clipboard.writeText(url);
                btnShare.textContent = 'Link Copied!';
                setTimeout(() => { btnShare.textContent = 'Share Config'; }, 2000);
            } catch {
                prompt('Copy this link:', url);
            }
        });
    }

    // ==================== RANGE SLIDER VISUALS ====================
    function updateRangeBackground(rangeInput) {
        const value = ((rangeInput.value - rangeInput.min) / (rangeInput.max - rangeInput.min)) * 100;
        rangeInput.style.background = `linear-gradient(to right, var(--primary) 0%, var(--primary-dark) ${value}%, rgba(255,255,255,0.1) ${value}%, rgba(255,255,255,0.1) 100%)`;
    }

    document.querySelectorAll('input[type="range"]').forEach(slider => {
        updateRangeBackground(slider);
        const handler = (e) => {
            updateRangeBackground(e.target);
            e.target.setAttribute('aria-valuenow', e.target.value);
            // Direct label sync for immediate feedback
            if (e.target === elements.daytimeLoad) {
                elements.daytimeLoadVal.textContent = e.target.value;
            } else if (e.target === elements.solarTarget) {
                elements.solarTargetVal.textContent = e.target.value;
            } else if (e.target === elements.backupHours) {
                elements.backupHoursVal.textContent = e.target.value;
            }
        };
        slider.addEventListener('input', handler);
        slider.addEventListener('change', handler);
    });

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

    reportModal?.addEventListener('click', (e) => {
        if (e.target === reportModal) closeModal();
    });

    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Rate limiting (5 second cooldown)
            const now = Date.now();
            if (now - lastSubmitTime < 5000) {
                alert('Please wait a moment before submitting again.');
                return;
            }

            // Honeypot check
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
                    to_name: customerInfo.name,
                    to_email: customerInfo.email,
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
                    await emailjs.send(
                        EMAILJS_CONFIG.serviceId,
                        EMAILJS_CONFIG.customerTemplateId,
                        templateParams
                    );
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

    // ==================== INITIALIZATION ====================
    // Load state: URL params take priority, then localStorage, then defaults
    const loadedFromURL = loadFromURL();
    if (!loadedFromURL) loadFromLocalStorage();

    // Apply loaded UI state
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

    // Set active shift button
    shiftOptions.forEach(opt => {
        opt.classList.remove('active');
        opt.setAttribute('aria-checked', 'false');
        if (parseInt(opt.getAttribute('data-shift')) === currentShift) {
            opt.classList.add('active');
            opt.setAttribute('aria-checked', 'true');
        }
    });

    // Update slider visuals
    document.querySelectorAll('input[type="range"]').forEach(updateRangeBackground);

    updateBatteryOptions();
    calculate();
});
