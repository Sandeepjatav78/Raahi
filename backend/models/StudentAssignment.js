const mongoose = require('mongoose');

const studentAssignmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      required: true,
      index: true
    },
    stop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stop',
      default: null,
      index: true
    },
    notificationToken: {
      type: String
    },
    // Push notification preferences
    notificationPreferences: {
      enabled: { type: Boolean, default: true },
      // Alert when bus is X minutes away
      proximityMinutes: { type: Number, default: 5, min: 1, max: 30 },
      // Alert when bus is X meters away
      proximityMeters: { type: Number, default: 500, min: 100, max: 2000 },
      // Whether proximity alert was already sent for current trip
      lastProximityAlertTrip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
      // Arrival alert preference
      arrivalAlert: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

// Compound index for finding all students on a bus
studentAssignmentSchema.index({ bus: 1, student: 1 });

module.exports = mongoose.model('StudentAssignment', studentAssignmentSchema);
