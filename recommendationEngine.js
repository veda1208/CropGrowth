const stageNames = {
  sowing: 'Sowing / Planting',
  vegetative: 'Vegetative growth',
  flowering: 'Flowering',
  fruiting: 'Fruiting / Grain filling'
};

const levelNames = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
};

const defaultTimingByStage = {
  sowing: 'At planting / basal dose as locally recommended; do not place fertilizer directly in contact with seed.',
  vegetative: 'During active vegetative growth. Split top-dressing applications (now and again after 20-25 days) are recommended.',
  flowering: 'At flowering initiation stage only if the crop and soil-test plan call for it. Avoid excess nitrogen.',
  fruiting: 'During fruiting / grain filling, follow the crop-specific potash/nutrient schedule and avoid excess nitrogen.'
};

/**
 * Deterministic Rule-Based Recommendation Engine (Problem Statement 14)
 * Matches soil inputs (pH, N, P, K), crop profile, and growth stage against KB rules and dosage tables.
 */
function generateRecommendation({ cropDoc, matchingRules = [], soilInput, growthStage, area, unit }) {
  const areaNum = Number(area) || 1;
  const areaHa = unit === 'acre' ? areaNum * 0.404685642 : areaNum;

  const ph = soilInput?.ph !== null && soilInput?.ph !== undefined && soilInput?.ph !== '' ? Number(soilInput.ph) : null;
  const n = soilInput?.n || 'medium';
  const p = soilInput?.p || 'medium';
  const k = soilInput?.k || 'medium';

  const alerts = [];
  if (n === 'low') alerts.push('Nitrogen is marked low. Split Urea top-dressing is recommended; verify rate with a soil test.');
  if (p === 'low') alerts.push('Phosphorus is marked low. Apply basal phosphorus (DAP/SSP) near the root zone during sowing/early growth.');
  if (k === 'low') alerts.push('Potassium is marked low. Ensure adequate MOP (Potash) application for stress resistance and grain/fruit quality.');
  if (n === 'high') alerts.push('Nitrogen is marked high. Reduce Urea dosage by 20% to prevent lodging and pest susceptibility.');
  if (ph !== null && (ph < 5.5 || ph > 8.0)) {
    alerts.push(
      ph < 5.5
        ? `Entered soil pH (${ph}) is acidic (< 5.5). Consider agricultural liming based on local extension advice.`
        : `Entered soil pH (${ph}) is alkaline (> 8.0). Consider gypsum/organic matter amendments and split micronutrient application.`
    );
  }
  if (!alerts.length) {
    alerts.push('Soil N-P-K and pH parameters are within moderate ranges. Follow standard split application schedules.');
  }

  const nutrientFactor = { low: 1.20, medium: 1.0, high: 0.80 };
  const stageFactor = { sowing: 1.0, vegetative: 1.08, flowering: 0.92, fruiting: 0.90 }[growthStage] || 1.0;

  // Build lookup of explicit custom rules if any match this specific condition
  const ruleOverrides = {};
  for (const r of matchingRules) {
    for (const item of r.recommendations || []) {
      ruleOverrides[item.name.toLowerCase()] = item;
    }
  }

  const generatedRecommendations = (cropDoc.recommendedFertilizers || []).map((fert) => {
    const lowerName = fert.name.toLowerCase();
    const status = lowerName.includes('urea') ? n : lowerName.includes('dap') ? p : k;
    const factor = nutrientFactor[status] || 1.0;

    // Convert base rate (kg/acre) to kg/ha (1 hectare = 2.47105 acres)
    const baseRatePerHa = fert.ratePerHa ? fert.ratePerHa : fert.rate * 2.47105;
    const override = ruleOverrides[lowerName];
    const ratePerHa = override && override.quantityPerHa
      ? override.quantityPerHa * factor
      : baseRatePerHa * factor * stageFactor;

    const totalQuantity = ratePerHa * areaHa;
    const timingNote = override?.timing ? ` (${override.timing})` : '';

    return {
      fertilizerId: fert.fertilizerId || lowerName.replace(/[^a-z0-9]/g, ''),
      name: fert.name,
      ratePerHa: Number(ratePerHa.toFixed(2)),
      totalQuantity: Number(totalQuantity.toFixed(2)),
      unit: 'kg/ha',
      why: `${fert.why} Adjusted for ${(levelNames[status] || 'medium').toLowerCase()} nutrient status and ${(stageNames[growthStage] || growthStage).toLowerCase()} stage.${timingNote}`
    };
  });

  const timing =
    (matchingRules[0]?.recommendations?.[0]?.timing) ||
    defaultTimingByStage[growthStage] ||
    defaultTimingByStage.sowing;

  return {
    areaHa: Number(areaHa.toFixed(4)),
    generatedRecommendations,
    timing,
    notes: cropDoc.notes || '',
    alerts
  };
}

module.exports = { generateRecommendation, stageNames, levelNames };
