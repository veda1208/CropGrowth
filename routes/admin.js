const express = require('express');
const User = require('../models/User');
const Crop = require('../models/Crop');
const Rule = require('../models/Rule');
const Recommendation = require('../models/Recommendation');
const Feedback = require('../models/Feedback');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication + admin/agronomist role
router.use(authenticate, requireAdmin);

// GET /api/admin/overview - Get all farmers, recommendation records, and feedback stats for Admin Control Center
router.get('/overview', async (req, res) => {
  try {
    const [users, recommendations, feedbacks] = await Promise.all([
      User.find({ role: 'user' }).sort({ createdAt: -1 }),
      Recommendation.find().sort({ generatedAt: -1 }),
      Feedback.find().sort({ createdAt: -1 })
    ]);

    const countByUser = {};
    recommendations.forEach((r) => {
      const uid = String(r.userId);
      countByUser[uid] = (countByUser[uid] || 0) + 1;
    });

    const accounts = users.map((u) => ({
      id: u._id.toString(),
      userId: u.userId || u._id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      location: u.location || '',
      role: u.role,
      disabled: Boolean(u.disabled),
      createdAt: u.createdAt,
      planCount: countByUser[String(u._id)] || 0
    }));

    const allRecords = recommendations.map((doc) => ({
      id: doc._id.toString(),
      recId: doc.recId || doc._id.toString(),
      userId: doc.userId?.toString(),
      ownerName: doc.ownerName || doc.farmerName || 'Farmer',
      ownerEmail: doc.ownerEmail || '',
      date: doc.generatedAt,
      farmerName: doc.farmerName || '',
      location: doc.location,
      crop: doc.cropId,
      stage: doc.growthStage,
      area: doc.area,
      unit: doc.unit,
      areaHa: doc.areaHa,
      ph: doc.soilInput?.ph ?? null,
      n: doc.soilInput?.n || 'medium',
      p: doc.soilInput?.p || 'medium',
      k: doc.soilInput?.k || 'medium',
      items: doc.generatedRecommendations || [],
      timing: doc.timing || '',
      notes: doc.notes || '',
      alerts: doc.alerts || [],
      feedback: doc.feedback || null
    }));

    res.json({ accounts, allRecords, feedbacks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id/toggle - Enable / Disable Farmer Account
router.patch('/users/:id/toggle', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Farmer account not found.' });
    }
    user.disabled = !user.disabled;
    await user.save();
    res.json({
      message: `Farmer account ${user.disabled ? 'disabled' : 'enabled'}.`,
      user: {
        id: user._id.toString(),
        email: user.email,
        disabled: user.disabled
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/crops - Add or Update Crop Profile (Role: Admin)
router.post('/crops', async (req, res) => {
  try {
    const { key, cropId, name, cropName, emoji = '🌱', npk, typicalNPK, notes = '', fertilizers, recommendedFertilizers } = req.body;
    const cleanKey = String(key || cropId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const displayName = String(name || cropName || '').trim();

    if (!cleanKey || !displayName) {
      return res.status(400).json({ error: 'Crop key (cropId) and display name (cropName) are required.' });
    }

    const exists = await Crop.findOne({ cropId: cleanKey });
    if (exists) {
      return res.status(409).json({ error: 'Crop profile with this key already exists. Use PUT to update.' });
    }

    const fertList = (fertilizers || recommendedFertilizers || [
      { fertilizerId: 'urea', name: 'Urea', rate: 25, unit: 'kg/acre', why: 'Nitrogen source; adjust per local soil test.' }
    ]).map((f) => ({
      fertilizerId: f.fertilizerId || String(f.name || 'fert').toLowerCase().replace(/[^a-z0-9]/g, ''),
      name: f.name,
      rate: Number(f.rate) || 0,
      unit: f.unit || 'kg/acre',
      why: f.why || ''
    }));

    const npkSummary = typeof npk === 'string' ? npk : (typicalNPK?.summary || 'Balanced N-P-K');

    const cropDoc = await Crop.create({
      cropId: cleanKey,
      cropName: displayName,
      emoji: emoji || '🌱',
      typicalNPK: {
        summary: npkSummary,
        N: typicalNPK?.N || 0,
        P: typicalNPK?.P || 0,
        K: typicalNPK?.K || 0
      },
      notes,
      recommendedFertilizers: fertList
    });

    res.status(201).json({ message: 'Crop profile added.', crop: cropDoc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/crops & PUT /api/admin/crops/:cropId - Update Crop Profile & Dosage Rules (Role: Admin)
async function updateCropHandler(req, res) {
  try {
    const targetKey = String(req.params.cropId || req.body.cropId || req.body.key || '').trim().toLowerCase();
    if (!targetKey) {
      return res.status(400).json({ error: 'cropId is required.' });
    }
    const { name, cropName, emoji, npk, typicalNPK, notes, fertilizers, recommendedFertilizers } = req.body;
    const cropDoc = await Crop.findOne({ cropId: targetKey });
    if (!cropDoc) {
      return res.status(404).json({ error: `Crop '${targetKey}' not found.` });
    }

    if (name || cropName) cropDoc.cropName = String(name || cropName).trim();
    if (emoji) cropDoc.emoji = emoji;
    if (npk !== undefined || typicalNPK !== undefined) {
      cropDoc.typicalNPK = {
        summary: typeof npk === 'string' ? npk : (typicalNPK?.summary || cropDoc.typicalNPK.summary),
        N: typicalNPK?.N ?? cropDoc.typicalNPK.N,
        P: typicalNPK?.P ?? cropDoc.typicalNPK.P,
        K: typicalNPK?.K ?? cropDoc.typicalNPK.K
      };
    }
    if (notes !== undefined) cropDoc.notes = notes;
    if (Array.isArray(fertilizers || recommendedFertilizers)) {
      const list = fertilizers || recommendedFertilizers;
      cropDoc.recommendedFertilizers = list.map((f) => ({
        fertilizerId: f.fertilizerId || String(f.name || 'fert').toLowerCase().replace(/[^a-z0-9]/g, ''),
        name: String(f.name).trim(),
        rate: Number(f.rate) || 0,
        unit: f.unit || 'kg/acre',
        why: String(f.why || '').trim()
      }));
    }

    await cropDoc.save();
    res.json({ message: 'Crop profile and fertilizer rules updated.', crop: cropDoc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.put('/crops', updateCropHandler);
router.put('/crops/:cropId', updateCropHandler);

// POST /api/admin/rules & PUT /api/admin/rules - Add / Update Fertilizer Rule in Rules Collection (Role: Admin)
router.post('/rules', async (req, res) => {
  try {
    const { ruleId, cropId, condition, recommendations } = req.body;
    if (!cropId || !Array.isArray(recommendations) || !recommendations.length) {
      return res.status(400).json({ error: 'cropId and recommendations array are required.' });
    }
    const cleanRuleId = ruleId || `rule_${cropId}_${Date.now()}`;
    const rule = await Rule.findOneAndUpdate(
      { ruleId: cleanRuleId },
      {
        ruleId: cleanRuleId,
        cropId: String(cropId).toLowerCase().trim(),
        condition: condition || {},
        recommendations
      },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: 'Rule saved.', rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/rules', async (req, res) => {
  try {
    const { ruleId, cropId, condition, recommendations } = req.body;
    if (!ruleId) {
      return res.status(400).json({ error: 'ruleId is required to update a rule.' });
    }
    const rule = await Rule.findOneAndUpdate(
      { ruleId },
      {
        ...(cropId ? { cropId: String(cropId).toLowerCase().trim() } : {}),
        ...(condition ? { condition } : {}),
        ...(recommendations ? { recommendations } : {})
      },
      { new: true }
    );
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found.' });
    }
    res.json({ message: 'Rule updated.', rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
