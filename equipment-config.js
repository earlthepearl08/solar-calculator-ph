/* ============================================================================
 * KINMO PW — EQUIPMENT RECOMMENDATION CONFIG (edit me!)
 * ----------------------------------------------------------------------------
 * This is the single place to update recommended hardware SKUs. The calculator
 * reads this at runtime to show an "Indicative" equipment card. Numbers here do
 * NOT affect the savings/ROI math — they only drive the recommendation labels.
 *
 * How inverter selection works:
 *   For a computed system size (kWp) and project scale, we pick the FIRST tier
 *   whose `upToKwp` is >= the system size. If the system is bigger than the
 *   largest tier, we recommend multiple units of the largest tier.
 *
 * How battery selection works (hybrid / off-grid only):
 *   number of units = ceil(recommended storage kWh / battery.unitKwh)
 * ========================================================================== */
window.KINMO_EQUIPMENT = {
    disclaimer: 'Indicative — final design upon site assessment.',

    // DYNESS 314Ah LiFePO4 module: 51.2V x 314Ah ≈ 16.08 kWh usable-nominal per unit.
    battery: {
        brand: 'DYNESS',
        model: '314Ah (51.2V) LiFePO4',
        unitKwh: 16.08
    },

    // GoodWe inverter tiers per project scale. `upToKwp` = the largest system this
    // model comfortably covers. Order from smallest to largest.
    inverterTiers: {
        'Residential': [
            { upToKwp: 8,  model: 'GoodWe 8kW single-phase hybrid' },
            { upToKwp: 10, model: 'GoodWe 10kW single-phase hybrid' },
            { upToKwp: 12, model: 'GoodWe 12kW single-phase hybrid' }
        ],
        'C&I': [
            { upToKwp: 30, model: 'GoodWe 30kW three-phase (LV)' },
            { upToKwp: 50, model: 'GoodWe 50kW three-phase (HV)' }
        ],
        'Utility Scale': [
            { upToKwp: 50, model: 'GoodWe 50kW three-phase (HV)' }
        ]
    }
};
