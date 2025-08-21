import mongoose from "mongoose";

const emailSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.ObjectId,
    ref: "Appointment",
    required: true,
  },
  patientEmail: {
    type: String,
    required: true,
  },
  emailType: {
    type: String,
    enum: ["accepted", "rejected", "pending"],
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
  availableSlots: {
    date: String,
    times: [String],
  },
});

export const Email = mongoose.model("Email", emailSchema);
