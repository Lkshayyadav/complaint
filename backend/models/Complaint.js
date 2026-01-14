// backend/models/Complaint.js
// Complaint schema for MongoDB

const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  studentEmail: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['Academic', 'Hostel', 'Library', 'Canteen', 'Infrastructure'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  imagePath: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Resolved', 'Rejected'],
    default: 'Pending'
  },
  assignedTo: {
    type: String,
    default: ''
  },
  remarks: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
ComplaintSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Complaint', ComplaintSchema);