const express = require('express');
const Crop = require('../models/Crop');
const Rule = require('../models/Rule');
const Recommendation = require('../models/Recommendation');
const Feedback = require('../models/Feedback');
const { authenticate } = require('../middleware/auth');
const { generateRecommendation } = require('../utils/recommendationEngine');

const router = express.Router();

function formatRecForFrontend(doc) {
  return {
    id: doc._id.toString(),
    recId: doc.recId || doc._id.toString(),
    userId: doc.userId?.toString(),
    ownerName: doc.ownerName || doc.farmerName || 'Farmer',
    ownerEmail: doc.ownerEmail || '',
    date: doc.generatedAt,
    generatedAt: doc.generatedAt,
    farmerName: doc.farmerName || '',
    location: doc.location,
    crop: doc.cropId,
    cropId: doc.cropId,
    stage: doc.growthStage,
    growthStage: doc.growthStage,
    area: doc.area,
    unit: doc.unit,
    areaHa: doc.areaHa,
    ph: doc.soilInput?.ph ?? null,
    n: doc.soilInput?.n || 'medium',
    p: doc.soilInput?.p || 'medium',
    k: doc.soilInput?.k || 'medium',
    soilInput: doc.soilInput,
    items: doc.generatedRecommendations || [],
    generatedRecommendations: doc.generatedRecommendations || [],
    timing: doc.timing || '',
    notes: doc.notes || '',
    alerts: doc.alerts || [],
    saved: doc.saved,
    feedback: doc.feedback || null
  };
}

// POST /api/recommendations/request - Submit Soil Data & Request Recommendation (Role: User)
router.post('/request', authenticate, async (req, res) => {
  try {
    const {
      farmerName = '',
      location,
      crop,
      cropId,
      stage,
      growthStage,
      area,
      unit = 'acre',
      ph = null,
      n = 'medium',
      p = 'medium',
      k = 'medium',
      soilInput
    } = req.body;

    const targetCropId = String(crop || cropId || '').toLowerCase().trim();
    const targetStage = String(stage || growthStage || '').toLowerCase().trim();

    if (!location || !targetCropId || !targetStage || !area || Number(area) <= 0) {
      return res.status(400).json({ error: 'Location, crop, growth stage, and positive area are required.' });
    }

    const parsedSoil = soilInput || {
      ph: ph === '' || ph === null || ph === undefined ? null : Number(ph),
      n: String(n || 'medium').toLowerCase(),
      p: String(p || 'medium').toLowerCase(),
      k: String(k || 'medium').toLowerCase()
    };

    if (parsedSoil.ph !== null && (parsedSoil.ph < 0 || parsedSoil.ph > 14)) {
      return res.status(400).json({ error: 'Soil pH must be between 0 and 14.' });
    }

    const cropDoc = await Crop.findOne({ cropId: targetCropId });
    if (!cropDoc) {
      return res.status(404).json({ error: `Crop profile '${targetCropId}' not found in knowledge base.` });
    }

    // Query matching rules from Rules collection
    const allCropRules = await Rule.find({ cropId: targetCropId });
    const matchingRules = allCropRules.filter((rule) => {
      const c = rule.condition || {};
      const stageMatch = !c.growthStage || c.growthStage === 'any' || c.growthStage === targetStage;
      const nMatch = !c.nLevel || c.nLevel === 'any' || c.nLevel === parsedSoil.n;
      const pMatch = !c.pLevel || c.pLevel === 'any' || c.pLevel === parsedSoil.p;
      const kMatch = !c.kLevel || c.kLevel === 'any' || c.kLevel === parsedSoil.k;
      const phMatch =
        parsedSoil.ph === null ||
        ((c.minPh === undefined || parsedSoil.ph >= c.minPh) &&
          (c.maxPh === undefined || parsedSoil.ph <= c.maxPh));
      return stageMatch && nMatch && pMatch && kMatch && phMatch;
    });

    const computed = generateRecommendation({
      cropDoc,
      matchingRules,
      soilInput: parsedSoil,
      growthStage: targetStage,
      area: Number(area),
      unit
    });

    const recDoc = await Recommendation.create({
      userId: req.user._id,
      ownerName: req.user.name || farmerName || 'Farmer',
      ownerEmail: req.user.email || '',
      farmerName: farmerName || req.user.name || '',
      location: String(location).trim(),
      cropId: targetCropId,
      soilInput: parsedSoil,
      growthStage: targetStage,
      area: Number(area),
      unit: unit === 'hectare' ? 'hectare' : 'acre',
      areaHa: computed.areaHa,
      generatedRecommendations: computed.generatedRecommendations,
      timing: computed.timing,
      notes: computed.notes,
      alerts: computed.alerts,
      saved: true
    });

    res.status(201).json({
      recommendation: formatRecForFrontend(recDoc)
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate recommendation.' });
  }
});

// GET /api/recommendations/user/:userId - Get User History (Role: User)
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.userId === 'me' ? req.user._id : req.params.userId;
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'agronomist' &&
      String(req.user._id) !== String(targetUserId)
    ) {
      return res.status(403).json({ error: 'Not authorized to view another user’s history.' });
    }
    const recs = await Recommendation.find({ userId: targetUserId }).sort({ generatedAt: -1 });
    res.json({
      recommendations: recs.map(formatRecForFrontend)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recommendations/:id - Get Recommendation by ID (Role: User / Admin)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const rec = await Recommendation.findById(req.params.id);
    if (!rec) {
      return res.status(404).json({ error: 'Recommendation not found.' });
    }
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'agronomist' &&
      String(rec.userId) !== String(req.user._id)
    ) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    res.json({ recommendation: formatRecForFrontend(rec) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recommendations/:id/save - Save Recommendation (Role: User)
router.post('/:id/save', authenticate, async (req, res) => {
  try {
    const rec = await Recommendation.findById(req.params.id);
    if (!rec) {
      return res.status(404).json({ error: 'Recommendation not found.' });
    }
    rec.saved = true;
    await rec.save();
    res.json({ message: 'Recommendation saved successfully.', recommendation: formatRecForFrontend(rec) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/recommendations/:id - Delete Recommendation from User History
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const rec = await Recommendation.findById(req.params.id);
    if (!rec) {
      return res.status(404).json({ error: 'Recommendation not found.' });
    }
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'agronomist' &&
      String(rec.userId) !== String(req.user._id)
    ) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    await Recommendation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Recommendation deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recommendations/:id/feedback - Submit Feedback (Role: User)
router.post('/:id/feedback', authenticate, async (req, res) => {
  try {
    const { rating, comments = '' } = req.body;
    if (!rating) {
      return res.status(400).json({ error: 'Rating is required.' });
    }
    const rec = await Recommendation.findById(req.params.id);
    if (!rec) {
      return res.status(404).json({ error: 'Recommendation not found.' });
    }
    rec.feedback = String(rating);
    await rec.save();

    const feedbackDoc = await Feedback.findOneAndUpdate(
      { recId: rec._id, userId: req.user._id },
      { rating: String(rating), comments: String(comments), createdAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Feedback recorded.',
      feedback: feedbackDoc,
      recommendation: formatRecForFrontend(rec)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
