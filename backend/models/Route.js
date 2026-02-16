const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    geojson: {
      type: Object,
      default: null
    },
    stops: [
      {
        name: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        seq: { type: Number, required: true }
      }
    ],
    segStats: [
      {
        avgSec: { type: Number, default: 120 },
        samples: { type: Number, default: 1 }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Route', routeSchema);
