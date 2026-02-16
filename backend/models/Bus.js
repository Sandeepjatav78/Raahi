const mongoose = require('mongoose');

const busSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    numberPlate: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    capacity: {
      type: Number,
      min: 1,
      default: 40
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastKnownLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bus', busSchema);
