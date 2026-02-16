const mongoose = require('mongoose');

const stopEventSchema = new mongoose.Schema(
  {
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true
    },
    stop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stop',
      index: true
    },
    stopIndex: {
      type: Number,
      required: true
    },
    stopName: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['ARRIVED', 'LEFT', 'SOS'],
      required: true,
      index: true
    },
    message: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      lat: Number,
      lng: Number
    },
    source: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'auto'
    },
    etaMinutes: {
      type: Number,
      min: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('StopEvent', stopEventSchema);
