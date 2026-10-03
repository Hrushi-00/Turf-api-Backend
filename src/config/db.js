const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  if (!process.env.MONGO_URL) throw new Error('MONGO_URL is required');
  const conn = await mongoose.connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 10000
  });
  console.log(`MongoDB Connected: ${conn.connection.host}`);
  return conn;
};

module.exports = connectDB;
