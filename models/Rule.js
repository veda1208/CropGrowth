const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  ruleId: { type: String, required: true, unique: true },
  cropId: { type: String, required: true, lowercase: true, trim: true },
  condition: {
    minPh: { type: Number, default: 5.5 },
    maxPh: { type: Number, default: 8.0 },
    nLevel: { type: String, enum: ['low', 'medium', 'high', 'any'], default: 'any' },
    pLevel: { type: String, enum: ['low', 'medium', 'high', 'any'], default: 'any' },
    kLevel: { type: String, enum: ['low', 'medium', 'high', 'any'], default: 'any' },
    growthStage: { type: String, enum: ['sowing', 'vegetative', 'flowering', 'fruiting', 'any'], default: 'any' }
  },
  recommendations: [{
    fertilizerId: { type: String, required: true },
    name: { type: String, required: true },
    quantityPerHa: { type: Number, required: true },
    timing: { type: String, required: true },
    notes: { type: String, default: '' }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Rule', ruleSchema);
