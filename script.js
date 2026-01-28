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

    // Animated Counter Function
    function animateValue(element, start, end, duration = 800, suffix = '') {
        if (!element) return;

        const startTime = performance.now();
        const range = end - start;

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = start + (range * easeOutQuart);

            element.textContent = current.toFixed(end < 10 ? 2 : 1) + suffix;
            element.classList.add('updating');

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                setTimeout(() => element.classList.remove('updating'), 300);
            }
        }

        requestAnimationFrame(update);
    }

    // DOM Elements
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
        statusAlerts: document.getElementById('statusAlerts')
    };

    // Current shift selection (for C&I and Utility Scale)
    let currentShift = 1;

    const batteryOptionsMap = {
        'Residential': { '5kWh': 5, '10kWh': 10, '15kWh': 15 },
        'C&I': { '100kWh': 100, '215kWh': 215, '1MWh': 1000 },
        'Utility Scale': { '215kWh': 215, '1MWh': 1000 }
    };

    // Constants
    const PSH = 4.0;
    const EFFICIENCY = 0.80;
    const PANEL_SIZE_SQM = 3.0;
    const SYSTEM_LIFESPAN_YEARS = 15;

    // Cost per kWp by project scale and capacity
    // Residential: ₱45,000/kWp
    // C&I 21-100kWp: ₱42,000/kWp
    // C&I 100-300kWp: ₱38,500/kWp
    // Utility Scale (300kWp+): ₱35,000/kWp
    function getCostPerKwp(scale, capacityKwp) {
        if (scale === 'Residential') {
            return 45000;
        } else if (scale === 'C&I') {
            if (capacityKwp <= 100) {
                return 42000;
            } else {
                return 38500;
            }
        } else {
            // Utility Scale (>300kWp)
            return 35000;
        }
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

    // Find optimal battery configuration
    // Returns: { unitKwh, numUnits, totalKwh, label }
    function findOptimalBattery(requiredKwh, scale) {
        const options = batteryOptionsMap[scale];
        if (!options || requiredKwh <= 0) {
            return { unitKwh: 0, numUnits: 0, totalKwh: 0, label: '' };
        }

        let bestOption = null;
        let smallestTotal = Infinity;

        // Try each battery size
        for (const [label, unitKwh] of Object.entries(options)) {
            const numUnits = Math.ceil(requiredKwh / unitKwh);
            const totalKwh = numUnits * unitKwh;

            // Prefer smallest total capacity
            // If tied, prefer fewer larger units (which is automatic since we iterate small to large)
            if (totalKwh < smallestTotal) {
                smallestTotal = totalKwh;
                bestOption = { unitKwh, numUnits, totalKwh, label };
            } else if (totalKwh === smallestTotal && bestOption) {
                // If same total, prefer fewer units (larger unit size)
                if (numUnits < bestOption.numUnits) {
                    bestOption = { unitKwh, numUnits, totalKwh, label };
                }
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
        // Default to last
        elements.batteryUnit.selectedIndex = elements.batteryUnit.options.length - 1;
    }

    function calculate() {
        const scale = elements.projectScale.value;
        const type = elements.systemType.value;
        const bill = parseFloat(elements.bill.value) || 0;
        const rate = parseFloat(elements.rate.value) || 0;
        const solarTargetPct = type === 'Off-Grid' ? 100 : parseInt(elements.solarTarget.value);
        const area = parseFloat(elements.area.value) || 0;
        const wattage = parseFloat(elements.wattage.value) || 620;

        // Calculate daytime load percentage based on project scale
        let daytimeLoadPct;
        if (scale === 'Residential') {
            daytimeLoadPct = parseInt(elements.daytimeLoad.value);
        } else {
            // For C&I and Utility Scale, convert shifts to daytime percentage
            // Peak sun hours: 8am-4pm (8 hours), with extended generation until ~6pm
            // 1 shift = 8 hours starting at 6am (6am-2pm) = ~85% overlap
            //   (Most of shift during peak sun + spillover generation continues post-shift)
            // 2 shifts = 16 hours (6am-10pm) = ~55% daytime coverage
            //   (8 peak hours + 2 hours spillover generation / 16 hours)
            // 3 shifts = 24 hours = ~40% daytime coverage
            //   (8 peak hours + 2 hours spillover / 24 hours)
            // Note: Solar panels continue generating for ~2 hours after shift ends during late afternoon
            const shiftToDaytimeMap = {
                1: 85,  // 1 shift: peak daytime coverage + spillover
                2: 55,  // 2 shifts: moderate daytime coverage
                3: 40   // 3 shifts: 24/7 operation with extended generation
            };
            daytimeLoadPct = shiftToDaytimeMap[currentShift] || 55;
        }

        const backupHours = parseInt(elements.backupHours.value);
        const enableNetMetering = elements.enableNetMetering.checked;
        const genChargeRate = parseFloat(elements.genCharge.value) || 0;

        // Visual labels
        elements.displayProjectScale.textContent = scale + " Project";
        elements.solarTargetVal.textContent = solarTargetPct;
        elements.daytimeLoadVal.textContent = daytimeLoadPct;
        elements.backupHoursVal.textContent = backupHours;

        // Core Logic
        const monthlyKwh = rate > 0 ? bill / rate : 0;
        const dailyKwh = monthlyKwh / 30;
        const targetDailySolarKwh = dailyKwh * (solarTargetPct / 100);

        const designFactor = type === 'Off-Grid' ? 1.25 : 1.0;
        const requiredKwp = (PSH * EFFICIENCY > 0) ? (targetDailySolarKwh / (PSH * EFFICIENCY)) * designFactor : 0;

        let numPanelsRequired = Math.ceil((requiredKwp * 1000) / wattage) || 0;
        numPanelsRequired = Math.ceil(numPanelsRequired / 2) * 2;

        const totalPanelsPossible = Math.floor(area / PANEL_SIZE_SQM) || 0;
        const cappedPanelsPossible = Math.floor(totalPanelsPossible / 2) * 2;

        // Final Metrics
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

        // Production Details
        const effectiveDailySolarKwh = displayKwp * PSH * EFFICIENCY;
        const daytimeLoadKwh = dailyKwh * (daytimeLoadPct / 100);
        const nighttimeLoadKwh = dailyKwh - daytimeLoadKwh;

        const directConsumedKwh = Math.min(effectiveDailySolarKwh, daytimeLoadKwh);
        const surplusSolarKwh = Math.max(0, effectiveDailySolarKwh - daytimeLoadKwh);

        // Battery Logic - Find optimal battery configuration
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
        const usableBatteryKwh = batteryCapacityTotal * 0.9;
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
            c1Desc = "Direct self-consumption based on " + daytimeLoadPct + "% daytime load";
            c1DailySavingsKwh = directConsumedKwh;
            residualSurplusKwh = surplusSolarKwh;
        } else if (type === 'Hybrid') {
            c1Title = "1. Hybrid (PV + Battery)";
            c1Desc = "Direct cons. + " + backupHours + "h battery backup usage";
            c1DailySavingsKwh = directConsumedKwh + batteryShiftedKwh;
            residualSurplusKwh = Math.max(0, surplusSolarKwh - usableBatteryKwh);
        } else {
            c1Title = "1. Off-Grid (PV + Battery)";
            c1Desc = "Full 24h operation coverage (" + backupHours + "h storage config)";
            c1DailySavingsKwh = directConsumedKwh + batteryShiftedKwh;
            residualSurplusKwh = 0;
        }

        const c1MonthlySavings = Math.min(c1DailySavingsKwh * 30 * rate, bill);
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

            const c2GrossMonthly = (c1DailySavingsKwh * 30 * rate) + (residualSurplusKwh * 30 * genChargeRate);
            const c2MonthlySavings = Math.min(c2GrossMonthly, bill);
            const c2Offset = dailyKwh > 0 ? (effectiveDailySolarKwh / dailyKwh * 100) : 0;

            elements.sc2Monthly.textContent = formatPHP(c2MonthlySavings);
            elements.sc2Offset.textContent = Math.min(c2Offset, 100).toFixed(1) + "% Total Offset";
            elements.sc2Yearly.textContent = "Est. " + formatPHP(c2MonthlySavings * 12).split('.')[0] + " / year";
        }

        // ROI and Payback Period Calculation
        const costPerKwp = getCostPerKwp(scale, displayKwp);
        const estimatedSystemCost = displayKwp * costPerKwp;
        const annualSavings = c1MonthlySavings * 12;
        const paybackYears = annualSavings > 0 ? estimatedSystemCost / annualSavings : 0;
        const totalLifetimeSavings = annualSavings * SYSTEM_LIFESPAN_YEARS;
        const roi = estimatedSystemCost > 0 ? ((totalLifetimeSavings - estimatedSystemCost) / estimatedSystemCost * 100) : 0;

        // Update ROI display
        if (elements.resSystemCost) {
            elements.resSystemCost.textContent = formatPHPShort(estimatedSystemCost);
        }
        if (elements.resPayback) {
            elements.resPayback.textContent = paybackYears > 0 ? paybackYears.toFixed(1) + " years" : "N/A";
        }
        if (elements.resROI) {
            elements.resROI.textContent = roi > 0 ? roi.toFixed(0) + "%" : "N/A";
        }

        // Store calculation results for PDF report
        window.solarCalcResults = {
            scale,
            type,
            systemCapacity: displayKwp,
            numPanels: displayPanels,
            areaUsed: displayArea,
            monthlyBill: bill,
            rate,
            monthlyGeneration: effectiveDailySolarKwh * 30,
            monthlySavings: c1MonthlySavings,
            annualSavings,
            billOffset: Math.min(c1Offset, 100),
            estimatedSystemCost,
            costPerKwp,
            paybackYears,
            roi,
            lifetimeSavings: totalLifetimeSavings,
            batteryConfig: type !== 'Grid-Tied' ? `${numBatt}x ${batteryUnitLabel}` : 'None'
        };

        // Details
        elements.detMonthlyGen.textContent = (effectiveDailySolarKwh * 30).toFixed(1) + " kWh";
        elements.detDirectCons.textContent = (directConsumedKwh * 30).toFixed(1) + " kWh";
        elements.detSurplus.textContent = (surplusSolarKwh * 30).toFixed(1) + " kWh";
        elements.detMonthlyReq.textContent = monthlyKwh.toFixed(1) + " kWh";

        // Battery assessment box
        if (type === 'Grid-Tied') {
            elements.detConfigTitle.textContent = "Battery Recommendation";
            if (surplusSolarKwh > 0) {
                const suggestedBattery = findOptimalBattery(surplusSolarKwh, scale);
                elements.detConfigContent.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">Adding <strong>${suggestedBattery.numUnits}x ${suggestedBattery.label}</strong> (${suggestedBattery.totalKwh.toFixed(1)} kWh total) would allow you to capture surplus solar and shift to nighttime savings.</p>`;
            } else {
                elements.detConfigContent.innerHTML = `<p style="color:var(--success-color); font-weight:600;">Your daytime load consumes all solar. Battery is optional for backup only.</p>`;
            }
        } else {
            elements.detConfigTitle.textContent = type + " Storage Setup";
            elements.detConfigContent.innerHTML = `
                <ul style="list-style:none; font-size:0.9rem; color:var(--text-muted);">
                    <li>Target Backup: <strong>${backupHours} hours</strong></li>
                    <li>Total Battery Units: <strong>${numBatt}x ${batteryUnitLabel}</strong></li>
                    <li>Total Capacity: <strong>${batteryCapacityTotal.toFixed(1)} kWh</strong></li>
                </ul>
            `;
        }

        // Status Alerts
        elements.statusAlerts.innerHTML = '';
        
        // Scale alignment check
        let actualCat = "";
        if (displayKwp <= 20) actualCat = "Residential";
        else if (displayKwp <= 300) actualCat = "C&I";
        else actualCat = "Utility Scale";

        if (scale !== actualCat) {
            const alert = document.createElement('div');
            alert.className = 'info-box';
            alert.style.backgroundColor = 'var(--card-bg)';
            alert.style.color = 'var(--text-muted)';
            alert.style.border = '1px solid var(--border-color)';
            alert.style.marginBottom = '1rem';
            alert.innerHTML = `Note: System sized as <strong>${actualCat}</strong> (${displayKwp.toFixed(1)} kWp). Consider aligning Project Scale for optimized options.`;
            elements.statusAlerts.appendChild(alert);
        }

        if (numPanelsRequired > cappedPanelsPossible) {
            const warning = document.createElement('div');
            warning.className = 'alert-box warning';
            warning.style.padding = '1rem';
            warning.style.marginBottom = '1rem';
            const offsetMax = dailyKwh > 0 ? (effectiveDailySolarKwh / dailyKwh * 100) : 0;
            warning.innerHTML = `Warning: Space insufficient for ${solarTargetPct}% target. Area limits system to ${cappedPanelsPossible} panels (${offsetMax.toFixed(1)}% offset).`;
            elements.statusAlerts.appendChild(warning);
        }
    }

    // Event Listeners
    [elements.projectScale, elements.systemType, elements.bill, elements.rate, elements.solarTarget,
     elements.area, elements.wattage, elements.daytimeLoad, elements.backupHours,
     elements.enableNetMetering, elements.genCharge].forEach(el => {
        el.addEventListener('input', calculate);
    });

    elements.projectScale.addEventListener('change', () => {
        const scale = elements.projectScale.value;
        // Toggle between daytime load and shift selector
        if (scale === 'Residential') {
            elements.daytimeLoadGroup.classList.remove('hidden');
            elements.shiftGroup.classList.add('hidden');
        } else {
            elements.daytimeLoadGroup.classList.add('hidden');
            elements.shiftGroup.classList.remove('hidden');
        }
        updateBatteryOptions();
        calculate();
    });

    elements.systemType.addEventListener('change', (e) => {
        const type = e.target.value;
        if (type === 'Off-Grid') {
            document.getElementById('offGridInfo').classList.remove('hidden');
            elements.solarTarget.disabled = true;
            elements.solarTarget.value = 100;
        } else {
            document.getElementById('offGridInfo').classList.add('hidden');
            elements.solarTarget.disabled = false;
        }

        if (type === 'Grid-Tied') {
            elements.batterySection.classList.add('hidden');
        } else {
            elements.batterySection.classList.remove('hidden');
        }
        calculate();
    });

    elements.enableNetMetering.addEventListener('change', (e) => {
        if (e.target.checked) {
            elements.genChargeGroup.classList.remove('hidden');
        } else {
            elements.genChargeGroup.classList.add('hidden');
        }
        calculate();
    });

    document.querySelectorAll('.clear-input').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');
            elements[targetId].value = '';
            calculate();
        });
    });

    // Shift selector event listeners
    document.querySelectorAll('.shift-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const shiftValue = parseInt(e.currentTarget.getAttribute('data-shift'));
            currentShift = shiftValue;

            // Update active state
            document.querySelectorAll('.shift-option').forEach(opt => opt.classList.remove('active'));
            e.currentTarget.classList.add('active');

            calculate();
        });
    });

    // Update range slider backgrounds dynamically
    function updateRangeBackground(rangeInput) {
        const value = ((rangeInput.value - rangeInput.min) / (rangeInput.max - rangeInput.min)) * 100;
        rangeInput.style.background = `linear-gradient(to right, #667eea 0%, #764ba2 ${value}%, rgba(255,255,255,0.1) ${value}%, rgba(255,255,255,0.1) 100%)`;
    }

    // Initialize range sliders with proper backgrounds
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        updateRangeBackground(slider);
        slider.addEventListener('input', (e) => {
            updateRangeBackground(e.target);
        });
    });

    // Add input focus animations
    document.querySelectorAll('.sidebar input, .sidebar select').forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });
        input.addEventListener('blur', () => {
            input.parentElement.classList.remove('focused');
        });
    });

    // Mobile Sidebar Toggle
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

        // Sidebar stays open while adjusting settings
        // User can close by tapping overlay or toggle button
    }

    // ==================== REPORT MODAL & PDF GENERATION ====================
    const reportModal = document.getElementById('reportModal');
    const btnGetReport = document.getElementById('btnGetReport');
    const modalClose = document.getElementById('modalClose');
    const reportForm = document.getElementById('reportForm');
    const reportSuccess = document.getElementById('reportSuccess');
    const btnCloseSuccess = document.getElementById('btnCloseSuccess');
    const btnSubmitText = document.getElementById('btnSubmitText');
    const btnSubmitLoading = document.getElementById('btnSubmitLoading');

    // Open modal
    if (btnGetReport) {
        btnGetReport.addEventListener('click', () => {
            reportModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    // Close modal
    function closeModal() {
        reportModal.classList.remove('active');
        document.body.style.overflow = '';
        // Reset form state
        reportForm.classList.remove('hidden');
        reportSuccess.classList.add('hidden');
        reportForm.reset();
    }

    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    if (btnCloseSuccess) {
        btnCloseSuccess.addEventListener('click', closeModal);
    }

    // Close on overlay click
    reportModal?.addEventListener('click', (e) => {
        if (e.target === reportModal) {
            closeModal();
        }
    });

    // Handle form submission
    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const customerInfo = {
                name: document.getElementById('customerName').value,
                email: document.getElementById('customerEmail').value,
                phone: document.getElementById('customerPhone').value,
                location: document.getElementById('customerLocation').value
            };

            // Show loading state
            btnSubmitText.classList.add('hidden');
            btnSubmitLoading.classList.remove('hidden');
            document.getElementById('btnSubmitReport').disabled = true;

            try {
                const results = window.solarCalcResults || {};

                // Prepare email template parameters (no PDF attachment)
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

                // Check if EmailJS is configured
                if (window.emailjs && EMAILJS_CONFIG.publicKey !== 'YOUR_PUBLIC_KEY') {
                    // Send email to customer
                    await emailjs.send(
                        EMAILJS_CONFIG.serviceId,
                        EMAILJS_CONFIG.customerTemplateId,
                        templateParams
                    );
                } else {
                    // Fallback if EmailJS not configured
                    console.warn('EmailJS not configured.');
                    pdf.save('Solar_Feasibility_Report_' + customerInfo.name.replace(/\s+/g, '_') + '.pdf');
                }

                // Show success state
                reportForm.classList.add('hidden');
                reportSuccess.classList.remove('hidden');

            } catch (error) {
                console.error('Error sending report:', error);
                alert('Error sending report. Please try again or contact support.');
            } finally {
                // Reset button state
                btnSubmitText.classList.remove('hidden');
                btnSubmitLoading.classList.add('hidden');
                document.getElementById('btnSubmitReport').disabled = false;
            }
        });
    }

    // Initial setup
    updateBatteryOptions();
    calculate();
});
