import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Email } from "../models/emailSchema.js";
import { Appointment } from "../models/appointmentSchema.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
// Validate email configuration
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error("Email credentials not configured in environment variables!");
  throw "Email service configuration missing";
}

// Configure nodemailer transporter with more options
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // For local testing only, remove in production
  },
});

// Test the transporter connection
transporter.verify((error) => {
  if (error) {
    console.error("Error verifying transporter:", error);
  } else {
    console.log("Server is ready to send emails");
  }
});

// Send email based on appointment status
export const sendAppointmentEmail = catchAsyncErrors(async (req, res, next) => {
  const { appointmentId, status, availableSlots } = req.body;

  // Validate input
  if (!appointmentId || !status) {
    return next(new ErrorHandler("Missing required fields!", 400));
  }

  const appointment = await Appointment.findById(appointmentId).populate(
    "doctor"
  );
  if (!appointment) {
    return next(new ErrorHandler("Appointment not found!", 404));
  }

  // Validate email address
  if (
    !appointment.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appointment.email)
  ) {
    return next(new ErrorHandler("Invalid patient email address!", 400));
  }

  // Email content templates
  const emailTemplates = {
    Accepted: {
      subject: "Appointment Confirmed - E-Cure Hub",
      getContent: (appointment, slots) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Appointment Confirmed!</h2>
          <p>Dear ${appointment.firstName} ${appointment.lastName},</p>
          <p>Great news! Your appointment has been <strong>confirmed</strong>.</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Appointment Details:</h3>
            <p><strong>Date:</strong> ${
              slots?.date ||
              new Date(appointment.appointment_date).toLocaleDateString()
            }</p>
            <p><strong>Time:</strong> ${
              slots?.times?.join(", ") || "As scheduled"
            }</p>
            <p><strong>Doctor:</strong> Dr. ${appointment.doctor.firstName} ${
        appointment.doctor.lastName
      }</p>
            <p><strong>Department:</strong> ${appointment.department}</p>
          </div>
          
          <p>Please arrive 15 minutes before your scheduled time.</p>
          <p>Best regards,<br>E-Cure Hub Medical Team</p>
        </div>
      `,
    },
    Pending: {
      subject: "Appointment Update - Available Slots - E-Cure Hub",
      getContent: (appointment, slots) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF9800;">Appointment Update</h2>
          <p>Dear ${appointment.firstName} ${appointment.lastName},</p>
          <p>Thank you for booking an appointment with us.</p>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Available Slots:</h3>
            <p><strong>Date:</strong> ${slots?.date || "To be confirmed"}</p>
            <p><strong>Available Times:</strong> ${
              slots?.times?.join(", ") || "Multiple slots available"
            }</p>
            <p><strong>Doctor:</strong> Dr. ${appointment.doctor.firstName} ${
        appointment.doctor.lastName
      }</p>
            <p><strong>Department:</strong> ${appointment.department}</p>
          </div>
          
          <p>We will confirm your exact appointment time soon.</p>
          <p>Best regards,<br>E-Cure Hub Medical Team</p>
        </div>
      `,
    },
    Rejected: {
      subject: "Appointment Status - E-Cure Hub",
      getContent: (appointment) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f44336;">Appointment Update</h2>
          <p>Dear ${appointment.firstName} ${appointment.lastName},</p>
          <p>We're sorry to inform you that your appointment request could not be accommodated.</p>
          
          <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Appointment Details:</h3>
            <p><strong>Requested Date:</strong> ${new Date(
              appointment.appointment_date
            ).toLocaleDateString()}</p>
            <p><strong>Doctor:</strong> Dr. ${appointment.doctor.firstName} ${
        appointment.doctor.lastName
      }</p>
            <p><strong>Department:</strong> ${appointment.department}</p>
          </div>
          
          <p>Please feel free to book another appointment.</p>
          <p>Best regards,<br>E-Cure Hub Medical Team</p>
        </div>
      `,
    },
  };

  const template = emailTemplates[status];
  if (!template) {
    return next(new ErrorHandler("Invalid status provided!", 400));
  }

  try {
    const mailOptions = {
      from: `"E-Cure Hub" <${process.env.EMAIL_USER}>`,
      to: appointment.email,
      subject: template.subject,
      html: template.getContent(appointment, availableSlots),
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Save email record
    const emailRecord = await Email.create({
      appointmentId,
      patientEmail: appointment.email,
      emailType: status.toLowerCase(),
      subject: template.subject,
      content: template.getContent(appointment, availableSlots),
      availableSlots,
    });

    res.status(200).json({
      success: true,
      message: "Email sent successfully!",
      emailRecord,
    });
  } catch (error) {
    console.error("Email sending error:", error);
    return next(
      new ErrorHandler(`Failed to send email: ${error.message}`, 500)
    );
  }
});

// Get email history for an appointment
export const getEmailHistory = catchAsyncErrors(async (req, res, next) => {
  const { appointmentId } = req.params;

  if (!appointmentId) {
    return next(new ErrorHandler("Appointment ID is required!", 400));
  }

  const emails = await Email.find({ appointmentId }).sort({ sentAt: -1 });

  res.status(200).json({
    success: true,
    emails,
  });
});
