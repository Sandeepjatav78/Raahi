const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      required: true,
      index: true
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'ONGOING', 'COMPLETED'],
      default: 'PENDING',
      index: true
    },
    currentStopIndex: {
      type: Number,
      default: 0
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    endedAt: Date,
    lastLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date
    },
    locations: [
      {
        lat: Number,
        lng: Number,
        speed: Number,
        heading: Number,
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trip', tripSchema);
