const mongoose = require('mongoose');

/**
 * Counter model for atomic sequential number generation.
 * Used to prevent race conditions when generating unique IDs like
 * DON_YYYY_MM_XXXXX and PAY_YYYY_MM_XXXXX.
 * 
 * Uses findOneAndUpdate with $inc for atomic incrementing,
 * eliminating the countDocuments + 1 race condition.
 */
const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  seq: {
    type: Number,
    default: 0
  }
}, {
  timestamps: false,
  versionKey: false
});

/**
 * Get the next sequence value for a given counter key.
 * Atomically increments and returns the new value.
 * Creates the counter document if it doesn't exist (upsert).
 * 
 * @param {String} counterKey - Unique key, e.g., 'donation_2026_02' or 'payment_2026_02'
 * @returns {Promise<Number>} The next sequence number
 */
counterSchema.statics.getNextSequence = async function(counterKey) {
  const counter = await this.findOneAndUpdate(
    { _id: counterKey },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
