const express = require('express');
const Crop = require('../models/Crop');
const Fertilizer = require('../models/Fertilizer');
const Rule = require('../models/Rule');

const router = express.Router();

// Helper to format Crop document for both API spec and frontend profiles dictionary
function formatCropForFrontend(c) {
  return {
    cropId: c.cropId,
    name: c.cropName,
    cropName: c.cropName,
    emoji: c.emoji || '🌱',
    npk: c.typicalNPK?.summary || '',
    typicalNPK: c.typicalNPK,
    notes: c.notes || '',
    fertilizers: (c.recommendedFertilizers || []).map((f) => ({
      fertilizerId: f.fertilizerId,
      name: f.name,
      rate: f.rate,
      unit: f.unit || 'kg/acre',
      why: f.why || ''
    })),
    recommendedFertilizers: c.recommendedFertilizers || []
  };
}

// GET /api/crops - Get Crops List (Role: All)
router.get('/crops', async (req, res) => {
  try {
    const crops = await Crop.find().sort({ cropName: 1 });
    const profilesMap = {};
    const list = crops.map((c) => {
      const formatted = formatCropForFrontend(c);
      profilesMap[c.cropId] = formatted;
      return formatted;
    });
    res.json({ crops: list, profiles: profilesMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kb - Get Knowledge Base (Crops, Fertilizers, Rules) (Role: All)
router.get('/kb', async (req, res) => {
  try {
    const [crops, fertilizers, rules] = await Promise.all([
      Crop.find().sort({ cropName: 1 }),
      Fertilizer.find().sort({ name: 1 }),
      Rule.find().sort({ cropId: 1 })
    ]);
    const profilesMap = {};
    crops.forEach((c) => {
      profilesMap[c.cropId] = formatCropForFrontend(c);
    });
    res.json({
      crops,
      profiles: profilesMap,
      fertilizers,
      rules
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
