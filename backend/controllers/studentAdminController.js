const bcrypt = require('bcryptjs');
const User = require('../models/User');
const StudentAssignment = require('../models/StudentAssignment');
const Bus = require('../models/Bus');
const Stop = require('../models/Stop');
const Route = require('../models/Route');
const { sendWelcomeEmail } = require('../utils/emailService');

const scrubPassword = (userDoc) => {
  if (!userDoc) return userDoc;
  const obj = userDoc.toObject ? userDoc.toObject() : userDoc;
  delete obj.password;
  return obj;
};

const listStudents = async (_req, res) => {
  const students = await User.find({ role: 'student' }).select('-password');
  res.json(students);
};

const createStudent = async (req, res) => {
  try {
    const { username, password, name, phone, email, busId, stopId } = req.body;
    if (!username) {
      return res.status(400).json({ message: 'username is required' });
    }
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const normalizedUsername = username.trim().toUpperCase();
    const plainPassword = (password || normalizedUsername).trim();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Case-insensitive duplicate check
    const existingUser = await User.findOne({
      username: { $regex: new RegExp(`^${normalizedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existingUser) {
      return res.status(409).json({ message: 'Roll number already registered' });
    }

    const student = await User.create({
      username: normalizedUsername,
      password: hashedPassword,
      role: 'student',
      name,
      phone,
      email: email.trim().toLowerCase(),
      firstLogin: true // Force password change on first login
    });

    // Create student assignment if bus provided
    let assignment = null;
    let busNumber = 'Not assigned yet';
    let routeName = 'Not assigned yet';
    let stopName = 'Not assigned yet';

    if (busId) {
      const bus = await Bus.findById(busId).populate('route');
      if (bus) {
        const assignmentData = {
          student: student._id,
          bus: busId
        };

        // Add stop if provided and valid
        if (stopId) {
          const stop = await Stop.findById(stopId);
          if (stop) {
            assignmentData.stop = stopId;
            stopName = stop.name;
          }
        }

        assignment = await StudentAssignment.create(assignmentData);
        busNumber = bus.numberPlate || bus.name;
        routeName = bus.route?.name || 'Unknown';
      }
    }

    // Send welcome email asynchronously (don't wait)
    sendWelcomeEmail({
      email: student.email,
      fullName: student.name || student.username,
      username: student.username,
      busNumber,
      routeName,
      stopName
    }).catch(err => console.error('Welcome email failed:', err.message));

    res.status(201).json({
      student: scrubPassword(student),
      assignment
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateStudent = async (req, res) => {
  try {
    const updates = {};
    ['username', 'name', 'phone', 'email'].forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    });

    if (req.body.password) {
      const hashedPassword = await bcrypt.hash(req.body.password.trim(), 10);
      updates.password = hashedPassword;
    }

    const student = await User.findOneAndUpdate({ _id: req.params.id, role: 'student' }, updates, {
      new: true,
      runValidators: true
    }).select('-password');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteStudent = async (req, res) => {
  const student = await User.findOneAndDelete({ _id: req.params.id, role: 'student' });
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  await StudentAssignment.deleteMany({ student: student._id });
  res.json({ message: 'Student removed' });
};

module.exports = { listStudents, createStudent, updateStudent, deleteStudent };
