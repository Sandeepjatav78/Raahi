const Bus = require('../models/Bus');
const Trip = require('../models/Trip');
const StopEvent = require('../models/StopEvent');
const StudentAssignment = require('../models/StudentAssignment');
const User = require('../models/User');
const { hashPassword } = require('./authController');

// Admin: assign or reassign students to bus + stop
const assignStudent = async (req, res) => {
  try {
    const { rollNumber, name, busId, stopId, studentId } = req.body;
    if ((!rollNumber && !studentId) || !busId || !stopId) {
      return res.status(400).json({ message: 'rollNumber/studentId, busId and stopId are required' });
    }

    let student = null;
    if (studentId) {
      student = await User.findOne({ _id: studentId, role: 'student' });
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }
      if (name && name !== student.name) {
        student.name = name;
        await student.save();
      }
    } else {
      const normalizedRoll = rollNumber.trim();
      student = await User.findOne({ username: normalizedRoll });
      if (!student) {
        const hashedPassword = await hashPassword(normalizedRoll);
        student = await User.create({
          username: normalizedRoll,
          password: hashedPassword,
          role: 'student',
          name: name || normalizedRoll
        });
      }
    }

    const assignment = await StudentAssignment.findOneAndUpdate(
      { student: student._id },
      { bus: busId, stop: stopId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
      .populate('student', 'username name')
      .populate({
        path: 'bus',
        select: 'name numberPlate driver',
        populate: { path: 'driver', select: 'name username' }
      })
      .populate('stop', 'name sequence');

    res.status(201).json(assignment);
  } catch (error) {
    console.error('assignStudent error:', error);
    res.status(500).json({ message: 'Failed to assign student', error: error.message });
  }
};

const getAssignments = async (_req, res) => {
  try {
    const assignments = await StudentAssignment.find()
      .populate('student', 'username name')
      .populate({
        path: 'bus',
        select: 'name numberPlate driver',
        populate: { path: 'driver', select: 'name username' }
      })
      .populate('stop', 'name sequence');
    res.json(assignments);
  } catch (error) {
    console.error('getAssignments error:', error);
    res.status(500).json({ message: 'Failed to fetch assignments', error: error.message });
  }
};

const updateAssignment = async (req, res) => {
  try {
    const assignment = await StudentAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const { studentId, busId, stopId } = req.body;
    if (studentId) assignment.student = studentId;
    if (busId) assignment.bus = busId;
    if (stopId) assignment.stop = stopId;

    await assignment.save();

    await assignment.populate([
      { path: 'student', select: 'username name' },
      {
        path: 'bus',
        select: 'name numberPlate driver',
        populate: { path: 'driver', select: 'name username' }
      },
      { path: 'stop', select: 'name sequence' }
    ]);

    res.json(assignment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const assignment = await StudentAssignment.findByIdAndDelete(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    res.json({ message: 'Assignment removed' });
  } catch (error) {
    console.error('deleteAssignment error:', error);
    res.status(500).json({ message: 'Failed to delete assignment', error: error.message });
  }
};

const getActiveTrips = async (_req, res) => {
  try {
    const trips = await Trip.find({ status: 'ONGOING' })
      .populate('bus', 'name numberPlate')
      .populate('driver', 'username name')
      .populate('route', 'name');
    res.json(trips);
  } catch (error) {
    console.error('getActiveTrips error:', error);
    res.status(500).json({ message: 'Failed to fetch active trips', error: error.message });
  }
};

const getEventHistory = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const events = await StopEvent.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('trip', 'bus driver')
      .populate('stop', 'name sequence');
    res.json(events);
  } catch (error) {
    console.error('getEventHistory error:', error);
    res.status(500).json({ message: 'Failed to fetch event history', error: error.message });
  }
};

const getDashboardStats = async (_req, res) => {
  try {
    const [busCount, driverCount, studentCount, activeTrips] = await Promise.all([
      Bus.countDocuments(),
      User.countDocuments({ role: 'driver' }),
      User.countDocuments({ role: 'student' }),
      Trip.countDocuments({ status: 'ONGOING' })
    ]);

    res.json({ busCount, driverCount, studentCount, activeTrips });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard stats', error: error.message });
  }
};

const fixStudentData = async (req, res) => {
  res.status(501).json({ message: 'Legacy fixStudentData is disabled.' });
};

const clearEvents = async (req, res) => {
  try {
    const result = await StopEvent.deleteMany({});
    res.json({ message: `Cleared ${result.deletedCount} events`, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('clearEvents error:', error);
    res.status(500).json({ message: 'Failed to clear events', error: error.message });
  }
};

const getLiveBusPositions = async (_req, res) => {
  try {
    // Get all ongoing trips with bus and driver info
    const trips = await Trip.find({ status: 'ONGOING' })
      .populate('bus', 'name numberPlate lastKnownLocation')
      .populate('driver', 'name username')
      .lean();

    // Also get student counts per bus
    const busIds = trips.map(t => t.bus?._id).filter(Boolean);
    const studentCounts = await StudentAssignment.aggregate([
      { $match: { bus: { $in: busIds } } },
      { $group: { _id: '$bus', count: { $sum: 1 } } }
    ]);
    const countMap = new Map(studentCounts.map(s => [s._id.toString(), s.count]));

    const busPositions = trips
      .filter(t => t.bus)
      .map(t => {
        const busId = t.bus._id.toString();
        const loc = t.bus.lastKnownLocation || t.lastLocation;
        return {
          _id: busId,
          tripId: t._id.toString(),
          name: t.bus.name,
          numberPlate: t.bus.numberPlate,
          driverName: t.driver?.name || t.driver?.username,
          lastPosition: loc ? { lat: loc.lat || loc.latitude, lng: loc.lng || loc.longitude } : null,
          studentCount: countMap.get(busId) || 0,
          startedAt: t.startedAt
        };
      })
      .filter(b => b.lastPosition?.lat && b.lastPosition?.lng);

    res.json(busPositions);
  } catch (error) {
    console.error('getLiveBusPositions error:', error);
    res.status(500).json({ message: 'Failed to fetch live bus positions', error: error.message });
  }
};

const getTripAnalytics = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get completed trips in time range
    const trips = await Trip.find({
      status: 'COMPLETED',
      endedAt: { $gte: since }
    })
      .populate('bus', 'name numberPlate')
      .lean();

    // Calculate metrics
    const totalTrips = trips.length;
    let totalDurationMs = 0;
    let totalStopsReached = 0;

    const perBus = {};

    trips.forEach(trip => {
      const duration = trip.endedAt && trip.startedAt
        ? new Date(trip.endedAt) - new Date(trip.startedAt)
        : 0;
      totalDurationMs += duration;
      totalStopsReached += trip.currentStopIndex || 0;

      const busId = trip.bus?._id?.toString();
      if (busId) {
        if (!perBus[busId]) {
          perBus[busId] = {
            name: trip.bus.name,
            numberPlate: trip.bus.numberPlate,
            tripCount: 0,
            totalDuration: 0,
            stopsReached: 0
          };
        }
        perBus[busId].tripCount++;
        perBus[busId].totalDuration += duration;
        perBus[busId].stopsReached += trip.currentStopIndex || 0;
      }
    });

    // Get today's event counts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEvents = await StopEvent.countDocuments({ timestamp: { $gte: today } });

    res.json({
      period: `${days} days`,
      totalTrips,
      averageDurationMinutes: totalTrips > 0 ? Math.round(totalDurationMs / totalTrips / 60000) : 0,
      totalStopsReached,
      todayEvents,
      busStats: Object.values(perBus).map(b => ({
        ...b,
        avgDurationMinutes: b.tripCount > 0 ? Math.round(b.totalDuration / b.tripCount / 60000) : 0
      }))
    });
  } catch (error) {
    console.error('getTripAnalytics error:', error);
    res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
  }
};

const exportTripsCSV = async (req, res) => {
  try {
    // Support token in query param for direct browser downloads
    const { days = 30, busId, token } = req.query;

    // If token provided in query, verify it (for new window downloads)
    if (token && !req.user) {
      const jwt = require('jsonwebtoken');
      const User = require('../models/User');
      const { JWT_SECRET } = require('../config/constants');

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user || user.role !== 'admin') {
          return res.status(401).json({ message: 'Unauthorized' });
        }
        req.user = user;
      } catch {
        return res.status(401).json({ message: 'Invalid token' });
      }
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const query = {
      status: 'COMPLETED',
      endedAt: { $gte: since }
    };
    if (busId) query.bus = busId;

    const trips = await Trip.find(query)
      .populate('bus', 'name numberPlate')
      .populate('driver', 'name username')
      .populate('route', 'name')
      .sort({ startedAt: -1 })
      .lean();

    // Build CSV content
    const headers = ['Trip ID', 'Bus Name', 'Number Plate', 'Driver', 'Route', 'Started At', 'Ended At', 'Duration (min)', 'Stops Reached'];
    const rows = trips.map(trip => {
      const startTime = trip.startedAt ? new Date(trip.startedAt).toISOString() : '';
      const endTime = trip.endedAt ? new Date(trip.endedAt).toISOString() : '';
      const durationMs = trip.endedAt && trip.startedAt
        ? new Date(trip.endedAt) - new Date(trip.startedAt)
        : 0;
      const durationMin = Math.round(durationMs / 60000);

      return [
        trip._id.toString(),
        trip.bus?.name || 'Unknown',
        trip.bus?.numberPlate || '',
        trip.driver?.name || trip.driver?.username || 'Unknown',
        trip.route?.name || 'Unknown',
        startTime,
        endTime,
        durationMin,
        trip.currentStopIndex || 0
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="trip-history-${days}days.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('exportTripsCSV error:', error);
    res.status(500).json({ message: 'Failed to export trips', error: error.message });
  }
};

module.exports = {
  assignStudent,
  getAssignments,
  updateAssignment,
  deleteAssignment,
  getActiveTrips,
  getEventHistory,
  getDashboardStats,
  fixStudentData,
  clearEvents,
  getLiveBusPositions,
  getTripAnalytics,
  exportTripsCSV
};
