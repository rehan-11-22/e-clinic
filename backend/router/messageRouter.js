import express from "express";
import {
  getAllMessages,
  sendMessage,
  deleteMessage,
  markAsRead,
  markAllAsRead,
  deleteAllMessages,
} from "../controller/messageController.js";
import { isAdminAuthenticated } from "../middlewares/auth.js";
const router = express.Router();

router.post("/send", sendMessage);
// Route to get all messages (only non-deleted)
router.get("/getall", isAdminAuthenticated, getAllMessages);

// Route to soft delete a message (mark as deleted)
router.put("/delete/:id", isAdminAuthenticated, deleteMessage);

// Route to mark a message as read
router.put("/read/:id", isAdminAuthenticated, markAsRead);
// Route to mark all messages as read
router.put("/markallread", isAdminAuthenticated, markAllAsRead);

router.put("/deleteall", isAdminAuthenticated, deleteAllMessages);

export default router;
