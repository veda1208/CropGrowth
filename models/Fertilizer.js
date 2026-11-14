const mongoose = require('mongoose');

const fertilizerSchema = new mongoose.Schema({
  fertilizerId: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  nutrientComposition: {
    N: { type: Number, default: 0 },
    P: { type: Number, default: 0 },
    K: { type: Number, default: 0 },
    label: { type: String, default: '' }
  },
  type: { type: String, required: true, trim: true }, // e.g., Urea, DAP, Potash, Organic
  instructions: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Fertilizer', fertilizerSchema);
