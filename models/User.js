const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, enum: ['user', 'agronomist', 'admin'], default: 'user' },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, default: '' },
  location: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', function (next) {
  if (!this.userId) {
    this.userId = this._id.toString();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
