const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  recId: { type: String, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerName: { type: String, default: 'Farmer' },
  ownerEmail: { type: String, default: '' },
  farmerName: { type: String, default: '' },
  location: { type: String, required: true },
  cropId: { type: String, required: true, lowercase: true },
  soilInput: {
    ph: { type: Number, default: null },
    n: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    p: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    k: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
  },
  growthStage: { type: String, enum: ['sowing', 'vegetative', 'flowering', 'fruiting'], required: true },
  area: { type: Number, required: true },
  unit: { type: String, enum: ['acre', 'hectare'], default: 'acre' },
  areaHa: { type: Number, required: true },
  generatedRecommendations: [{
    fertilizerId: { type: String },
    name: { type: String, required: true },
    ratePerHa: { type: Number, required: true },
    totalQuantity: { type: Number, required: true },
    unit: { type: String, default: 'kg/ha' },
    why: { type: String, default: '' }
  }],
  timing: { type: String, default: '' },
  notes: { type: String, default: '' },
  alerts: [{ type: String }],
  saved: { type: Boolean, default: true },
  feedback: { type: String, default: null },
  generatedAt: { type: Date, default: Date.now }
});

recommendationSchema.pre('save', function (next) {
  if (!this.recId) {
    this.recId = this._id.toString();
  }
  next();
});

module.exports = mongoose.model('Recommendation', recommendationSchema);
