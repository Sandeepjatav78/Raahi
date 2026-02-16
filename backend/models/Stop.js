const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    sequence: {
      type: Number,
      required: true
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true
    },
    averageTravelMinutes: {
      type: Number,
      default: 2,
      min: 1
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Stop', stopSchema);
