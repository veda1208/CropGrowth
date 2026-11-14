const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  feedbackId: { type: String, unique: true },
  recId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: String, required: true }, // e.g., 'Helpful', 'Not helpful', or 1-5
  comments: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

feedbackSchema.pre('save', function (next) {
  if (!this.feedbackId) {
    this.feedbackId = this._id.toString();
  }
  next();
});

module.exports = mongoose.model('Feedback', feedbackSchema);
