const mongoose = require('mongoose');

// Create a cached connection to avoid creating multiple mongoose connections in dev
let connectionCache = null;

const connectDB = async () => {
  if (connectionCache) {
    return connectionCache;
  }

  const uri = process.env.MONGO_URI;
  const dbName = process.env.DB_NAME || 'TrackMatev1';

  if (!uri) {
    throw new Error('MONGO_URI is not defined in the environment variables');
  }

  mongoose.set('strictQuery', true);

  connectionCache = mongoose
    .connect(uri, {
      dbName,
      maxPoolSize: 10
    })
    .then((conn) => {
      console.log('✅ MongoDB connected to database', dbName);
      return conn;
    })
    .catch((error) => {
      console.error('❌ MongoDB connection error:', error.message);
      process.exit(1);
    });

  return connectionCache;
};

module.exports = connectDB;
