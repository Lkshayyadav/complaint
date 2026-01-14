// backend/models/User.js
// User schema for MongoDB

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'admin', 'super_admin'],
    default: 'student'
  },
  department: {
    type: String,
    enum: ['Academic', 'Hostel', 'Library', 'Canteen', 'Infrastructure'],
    required: function() {
      return this.role === 'admin';
    }
  },
  studentId: {
    type: String,
    required: function() {
      return this.role === 'student';
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);