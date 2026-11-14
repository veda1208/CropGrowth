const mongoose = require('mongoose');

const recommendedFertilizerSchema = new mongoose.Schema({
  fertilizerId: { type: String, required: true },
  name: { type: String, required: true },
  rate: { type: Number, required: true }, // Base rate in kg/acre (converted to kg/ha in engine)
  ratePerHa: { type: Number },
  unit: { type: String, default: 'kg/acre' },
  why: { type: String, default: '' }
}, { _id: false });

const cropSchema = new mongoose.Schema({
  cropId: { type: String, required: true, unique: true, lowercase: true, trim: true },
  cropName: { type: String, required: true, trim: true },
  emoji: { type: String, default: '🌱' },
  typicalNPK: {
    summary: { type: String, required: true },
    N: { type: Number, default: 0 },
    P: { type: Number, default: 0 },
    K: { type: Number, default: 0 }
  },
  recommendedFertilizers: [recommendedFertilizerSchema],
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Crop', cropSchema);
