const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'driver', 'student'],
      required: true
    },
    name: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true, // Allow null but unique when set
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    firstLogin: {
      type: Boolean,
      default: true // Force password change on first login
    },
    assignedBusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus'
    }, // DEPRECATED: Use StudentAssignment model
    assignedStopId: {
      type: Number // sequence of stop in route.stops array
    }, // DEPRECATED: Use StudentAssignment model
    driverMeta: {
      bus: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bus',
        default: null
      }
    },
    pushSubscription: {
      type: Object, // Store the full PushSubscription JSON
      default: null
    },
    stopCoordinates: {
      lat: Number,
      lng: Number
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
