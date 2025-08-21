import express from "express";
import {
  sendAppointmentEmail,
  getEmailHistory,
} from "../controller/emailController.js";
import { isAdminAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.post("/send", isAdminAuthenticated, sendAppointmentEmail);
router.get("/history/:appointmentId", isAdminAuthenticated, getEmailHistory);

export default router;
