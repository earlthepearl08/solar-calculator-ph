document.addEventListener('DOMContentLoaded', () => {
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

    const batteryOptionsMap = {
        'Residential': { '5kWh': 5, '10kWh': 10, '15kWh': 15 },
        'C&I': { '15kWh': 15, '100kWh': 100, '215kWh': 215, '1MWh': 1000 },
        'Utility Scale': { '215kWh': 215, '1MWh': 1000 }
    };

    // Constants
    const PSH = 4.0;
    const EFFICIENCY = 0.80;
    const PANEL_SIZE_SQM = 3.0;

    function formatPHP(val) {
        return '₱ ' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        const daytimeLoadPct = parseInt(elements.daytimeLoad.value);
        const backupHours = parseInt(elements.backupHours.value);
        const batteryUnitKwh = parseFloat(elements.batteryUnit.value) || 0;
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

        elements.resCapacity.textContent = displayKwp.toFixed(2) + " kWp";
        elements.resPanels.textContent = displayPanels;
        elements.resArea.textContent = displayArea.toFixed(1) + " m²";

        // Production Details
        const effectiveDailySolarKwh = displayKwp * PSH * EFFICIENCY;
        const daytimeLoadKwh = dailyKwh * (daytimeLoadPct / 100);
        const nighttimeLoadKwh = dailyKwh - daytimeLoadKwh;

        const directConsumedKwh = Math.min(effectiveDailySolarKwh, daytimeLoadKwh);
        const surplusSolarKwh = Math.max(0, effectiveDailySolarKwh - daytimeLoadKwh);

        // Battery Logic
        const avgHourlyLoad = dailyKwh / 24;
        const backupStorageNeeded = avgHourlyLoad * backupHours;
        
        let numBatt = 0;
        if (type === 'Hybrid' || type === 'Off-Grid') {
            numBatt = batteryUnitKwh > 0 ? Math.ceil(backupStorageNeeded / batteryUnitKwh) : 0;
        } else {
            numBatt = batteryUnitKwh > 0 ? Math.ceil(surplusSolarKwh / batteryUnitKwh) : 1;
        }

        const batteryCapacityTotal = numBatt * batteryUnitKwh;
        const usableBatteryKwh = batteryCapacityTotal * 0.9;
        const batteryShiftedKwh = Math.min(surplusSolarKwh, usableBatteryKwh, nighttimeLoadKwh);

        if (type === 'Grid-Tied') {
            elements.resStorageCard.classList.add('hidden');
        } else {
            elements.resStorageCard.classList.remove('hidden');
            elements.resStorage.textContent = batteryCapacityTotal.toFixed(1) + " kWh";
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

        // Details
        elements.detMonthlyGen.textContent = (effectiveDailySolarKwh * 30).toFixed(1) + " kWh";
        elements.detDirectCons.textContent = (directConsumedKwh * 30).toFixed(1) + " kWh";
        elements.detSurplus.textContent = (surplusSolarKwh * 30).toFixed(1) + " kWh";
        elements.detMonthlyReq.textContent = monthlyKwh.toFixed(1) + " kWh";

        // Battery assessment box
        const batteryUnitLabel = elements.batteryUnit.options[elements.batteryUnit.selectedIndex]?.text || '';
        if (type === 'Grid-Tied') {
            elements.detConfigTitle.textContent = "Battery Recommendation";
            if (surplusSolarKwh > 0) {
                const suggest = batteryUnitKwh > 0 ? Math.ceil(surplusSolarKwh / batteryUnitKwh) : 1;
                elements.detConfigContent.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">Adding <strong>${suggest}x ${batteryUnitLabel}</strong> unit(s) would allow you to capture surplus solar and shift to nighttime savings.</p>`;
            } else {
                elements.detConfigContent.innerHTML = `<p style="color:var(--success-color); font-weight:600;">Your daytime load consumes all solar. Battery is optional for backup only.</p>`;
            }
        } else {
            elements.detConfigTitle.textContent = type + " Storage Setup";
            elements.detConfigContent.innerHTML = `
                <ul style="list-style:none; font-size:0.9rem; color:var(--text-muted);">
                    <li>Target Backup: <strong>${backupHours} hours</strong></li>
                    <li>Total Battery Units: <strong>${numBatt}x ${batteryUnitLabel}</strong></li>
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
            alert.style.backgroundColor = 'white';
            alert.style.color = 'var(--primary-color)';
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
     elements.batteryUnit, elements.enableNetMetering, elements.genCharge].forEach(el => {
        el.addEventListener('input', calculate);
    });

    elements.projectScale.addEventListener('change', () => {
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

    // Initial setup
    updateBatteryOptions();
    calculate();
});
