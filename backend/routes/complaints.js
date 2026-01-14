const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { authMiddleware, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { sendComplaintNotification, sendStatusUpdate } = require('../services/emailService');

// Configure Multer for file uploads
// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed (jpeg, jpg, png)!'));
  }
});



// @route   POST /api/complaints
// @desc    Create a new complaint (Student only)
// @access  Private
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { category, description } = req.body;
    const imagePath = req.file ? req.file.path : '';

    // Validate input
    if (!category || !description) {
      return res.status(400).json({ message: 'Please provide category and description' });
    }

    // Get user details
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create complaint
    const complaint = new Complaint({
      studentId: user._id,
      studentName: user.name,
      studentEmail: user.email,
      category,
      description,
      imagePath
    });

    await complaint.save();

    // Find admins for this category to notify
    // Also notify Super Admins
    const admins = await User.find({
      $or: [
        { role: 'admin', department: category },
        { role: 'super_admin' }
      ]
    });

    const adminEmails = admins.map(admin => admin.email);
    if (adminEmails.length > 0) {
      sendComplaintNotification(adminEmails, complaint);
    }

    // Send socket notification
    req.io.emit('new_complaint', complaint);

    res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while creating complaint' });
  }
});

// @route   GET /api/complaints/my
// @desc    Get all complaints by logged-in student
// @access  Private (Student)
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const complaints = await Complaint.find({ studentId: req.user.userId })
      .sort({ createdAt: -1 });

    res.json({ complaints });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching complaints' });
  }
});

// @route   GET /api/complaints
// @desc    Get all complaints (Admin & Super Admin)
// @access  Private (Admin, Super Admin)
router.get('/', authMiddleware, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { status, category } = req.query;
    const { role, department } = req.user;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;

    // Role-based filtering
    if (role === 'admin') {
      // Regular admin can ONLY see their department
      filter.category = department;
    } else if (role === 'super_admin') {
      // Super admin can filter by category if provided, or see all
      if (category) filter.category = category;
    }

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 });

    // Add isOverdue flag dynamically
    const complaintsWithSLA = complaints.map(complaint => {
      const isOverdue =
        complaint.status !== 'Resolved' &&
        complaint.status !== 'Rejected' &&
        (Date.now() - new Date(complaint.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000);

      return {
        ...complaint.toObject(),
        isOverdue
      };
    });

    res.json({ complaints: complaintsWithSLA });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching complaints' });
  }
});

// @route   GET /api/complaints/analytics
// @desc    Get complaint statistics
// @access  Private (Admin, Super Admin)
router.get('/analytics', authMiddleware, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { role, department } = req.user;
    const matchStage = {};

    if (role === 'admin') {
      matchStage.category = department;
    }

    const totalComplaints = await Complaint.countDocuments(matchStage);
    const resolvedComplaints = await Complaint.countDocuments({ ...matchStage, status: 'Resolved' });
    const pendingComplaints = await Complaint.countDocuments({ ...matchStage, status: 'Pending' });
    const rejectedComplaints = await Complaint.countDocuments({ ...matchStage, status: 'Rejected' });

    // Calculate pending > 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const overdueComplaints = await Complaint.countDocuments({
      ...matchStage,
      status: { $nin: ['Resolved', 'Rejected'] },
      createdAt: { $lt: sevenDaysAgo }
    });

    res.json({
      total: totalComplaints,
      resolved: resolvedComplaints,
      pending: pendingComplaints,
      rejected: rejectedComplaints,
      overdue: overdueComplaints
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching analytics' });
  }
});

// @route   PUT /api/complaints/:id
// @desc    Update complaint status/assignment (Admin only)
// @access  Private (Admin, Super Admin)
router.put('/:id', authMiddleware, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { status, assignedTo, remarks } = req.body;
    const { role, department } = req.user;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    // Authorization check for Dept Admin trying to edit other dept's complaint
    if (role === 'admin' && complaint.category !== department) {
      return res.status(403).json({ message: 'You can only manage complaints in your department' });
    }

    const oldStatus = complaint.status;

    // Update fields if provided
    if (status) complaint.status = status;
    if (assignedTo) complaint.assignedTo = assignedTo;
    if (remarks) complaint.remarks = remarks;

    await complaint.save();

    // Send email if status changed
    if (status && status !== oldStatus) {
      await sendStatusUpdate(complaint.studentEmail, complaint);
    }

    res.json({
      message: 'Complaint updated successfully',
      complaint
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while updating complaint' });
  }
});

// @route   DELETE /api/complaints/:id
// @desc    Delete a complaint (Admin only)
// @access  Private (Admin, Super Admin)
router.delete('/:id', authMiddleware, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { role, department } = req.user;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    if (role === 'admin' && complaint.category !== department) {
      return res.status(403).json({ message: 'You can only delete complaints in your department' });
    }

    await complaint.deleteOne();

    res.json({ message: 'Complaint deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while deleting complaint' });
  }
});

module.exports = router;