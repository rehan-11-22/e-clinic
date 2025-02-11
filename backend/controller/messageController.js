import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Message } from "../models/messageSchema.js";

export const sendMessage = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, message } = req.body;
  if (!firstName || !lastName || !email || !phone || !message) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }
  await Message.create({ firstName, lastName, email, phone, message });
  res.status(200).json({
    success: true,
    message: "Message Sent!",
  });
});
// get all messages
export const getAllMessages = catchAsyncErrors(async (req, res, next) => {
  const messages = await Message.find({ isDeleted: false }); // Filter out deleted messages
  res.status(200).json({
    success: true,
    messages,
  });
});

// Soft delete a message (Mark as deleted)
export const deleteMessage = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  // Find the message and update the isDeleted field
  const message = await Message.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true }
  );

  if (!message) {
    return next(new ErrorHandler("Message not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Message has been marked as deleted",
  });
});

// Mark message as read
export const markAsRead = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  // Find the message and update the isRead field
  const message = await Message.findByIdAndUpdate(
    id,
    { isRead: true },
    { new: true }
  );

  if (!message) {
    return next(new ErrorHandler("Message not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Message has been marked as read",
  });
});
// mark all as read
export const markAllAsRead = async (req, res) => {
  try {
    await Message.updateMany({}, { isRead: true }); // Update all messages
    res.status(200).json({
      success: true,
      message: "All messages marked as read",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// delete all messages
export const deleteAllMessages = async (req, res) => {
  try {
    // Instead of deleting, update all messages to be marked as deleted
    const result = await Message.updateMany({}, { isDeleted: true });

    console.log("Messages marked as deleted:", result.modifiedCount); // Debugging log

    res.status(200).json({
      success: true,
      message: "All messages have been marked as deleted",
    });
  } catch (error) {
    console.error("Error marking messages as deleted:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
