const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change this to another service
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // App password for Gmail
    }
});

// Generic send email function
const sendEmail = async (to, subject, html) => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log('Email credentials not found. simulating email send:', { to, subject });
            return;
        }

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            html
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully to:', to);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

// Send notification to Admin about new complaint
const sendComplaintNotification = async (adminEmails, complaint) => {
    const subject = `New Complaint: ${complaint.category} - ${complaint.studentName}`;
    const html = `
    <h3>New Complaint Received</h3>
    <p><strong>Student:</strong> ${complaint.studentName} (${complaint.studentEmail})</p>
    <p><strong>Category:</strong> ${complaint.category}</p>
    <p><strong>Description:</strong> ${complaint.description}</p>
    <p>Please login to the dashboard to take action.</p>
  `;

    // In a real app, you might want to send individual emails or use BCC
    for (const email of adminEmails) {
        await sendEmail(email, subject, html);
    }
};

// Send status update to Student
const sendStatusUpdate = async (studentEmail, complaint) => {
    const subject = `Complaint Status Updated: ${complaint.status}`;
    const html = `
    <h3>Your Complaint Status Has Changed</h3>
    <p><strong>Category:</strong> ${complaint.category}</p>
    <p><strong>New Status:</strong> ${complaint.status}</p>
    <p><strong>Remarks:</strong> ${complaint.remarks || 'No remarks provided.'}</p>
    <p><strong>Assigned To:</strong> ${complaint.assignedTo || 'Unassigned'}</p>
  `;

    await sendEmail(studentEmail, subject, html);
};

module.exports = { sendEmail, sendComplaintNotification, sendStatusUpdate };
