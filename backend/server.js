require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { ensureDefaultAccounts } = require('./controllers/authController');
const authRoutes = require('./routes/authRoutes');
const routeRoutes = require('./routes/routeRoutes');
const tripRoutes = require('./routes/tripRoutes');
const adminRoutes = require('./routes/adminRoutes');
const busRoutes = require('./routes/busRoutes');
const driverRoutes = require('./routes/driverRoutes');
const stopRoutes = require('./routes/stopRoutes');
const studentRoutes = require('./routes/studentRoutes');
const eventRoutes = require('./routes/eventRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { registerLocationHandlers } = require('./controllers/locationController');

const app = express();

// Trust proxy on hosted platforms (Render, Heroku, etc.) — required for rate limiting
app.set('trust proxy', 1);

const normalizeOrigin = (origin) => (origin || '').trim().replace(/\/+$/, '');

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const defaultDevOrigins = ['http://localhost:5173', 'http://localhost:3000'];

const corsOptions = {
  credentials: true,
  origin: (origin, callback) => {
    // Allow non-browser clients (curl/Postman/server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    const incomingOrigin = normalizeOrigin(origin);
    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) {
      return callback(null, true);
    }

    // In production, explicitly allow configured origins.
    if (allowedOrigins.includes(incomingOrigin)) {
      return callback(null, true);
    }

    // Optional convenience: allow Vercel preview deployments.
    try {
      const hostname = new URL(incomingOrigin).hostname;
      if (hostname.endsWith('.vercel.app')) {
        return callback(null, true);
      }
    } catch (_e) {
      // Ignore parse errors and continue to rejection below.
    }

    // Safe fallback for production if ALLOWED_ORIGINS is not configured yet.
    if (allowedOrigins.length === 0) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  }
};

if (process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0) {
  defaultDevOrigins.forEach((origin) => allowedOrigins.push(origin));
}

app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per window
  message: { message: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 registration attempts per hour
  message: { message: 'Too many registration attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
}));

app.use('/api/auth', authRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/stops', stopRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/students', studentRoutes); // Alias for frontend compatibility
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (_req, res) => {
  res.json({ message: 'Raahi backend is running' });
});

// Global error handler - must be last middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(err.status || 500).json({ 
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, you might want to gracefully shut down
  // For now, just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Graceful shutdown
  process.exit(1);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOptions.origin,
    credentials: true
  }
});
app.set('io', io);

// --- Live Visitor Counter ---
let liveVisitorCount = 0;

io.on('connection', (socket) => {
  liveVisitorCount++;
  io.emit('stats:live_visitors', liveVisitorCount);

  socket.on('disconnect', () => {
    liveVisitorCount = Math.max(0, liveVisitorCount - 1);
    io.emit('stats:live_visitors', liveVisitorCount);
  });
});

registerLocationHandlers(io);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await ensureDefaultAccounts();
  server.listen(PORT, '0.0.0.0', () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🚍 Raahi backend listening on port ${PORT}`);
    }
  });
};

start();
