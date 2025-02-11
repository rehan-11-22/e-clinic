import axios from "axios";
import React, { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Context } from "../main";
import { Navigate } from "react-router-dom";

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null); // Store message to be deleted
  const { isAuthenticated } = useContext(Context);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Fetching messages from the backend
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data } = await axios.get(
          "http://localhost:4000/api/v1/message/getall",
          { withCredentials: true }
        );
        setMessages(data.messages);
      } catch (error) {
        console.log(error.response.data.message);
      }
    };
    fetchMessages();
  }, []);

  // Handler for Mark as Read button
  const handleMarkAsRead = async (id) => {
    try {
      await axios.put(
        `http://localhost:4000/api/v1/message/read/${id}`,
        {},
        { withCredentials: true }
      );
      // Update message state to reflect changes
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === id ? { ...msg, isRead: true } : msg
        )
      );
      toast.success("Message marked as read!");
    } catch (error) {
      toast.error("Failed to mark message as read!");
    }
  };
  // mark as all read
  const handleMarkAllAsRead = async () => {
    try {
      await axios.put(
        "http://localhost:4000/api/v1/message/markallread",
        {},
        { withCredentials: true }
      );
      setMessages((prevMessages) =>
        prevMessages.map((msg) => ({ ...msg, isRead: true }))
      );
      toast.success("All messages marked as read!");
    } catch (error) {
      toast.error("Failed to mark all messages as read!");
    }
  };

  // Open the modal to confirm deletion
  const openDeleteModal = (id) => {
    setMessageToDelete(id); // Store the message ID to be deleted
    setShowModal(true); // Show the modal
  };

  // Handler for Delete button (Soft Delete)
  const handleDelete = async () => {
    try {
      await axios.put(
        `http://localhost:4000/api/v1/message/delete/${messageToDelete}`,
        {},
        { withCredentials: true }
      );
      // Remove deleted message from the state (frontend deletion)
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg._id !== messageToDelete)
      );
      setShowModal(false); // Close the modal
      toast.success("Message marked as deleted!");
    } catch (error) {
      toast.error("Failed to delete the message!");
      setShowModal(false); // Close the modal if error occurs
    }
  };

  // Close the modal without deleting the message
  const closeModal = () => {
    setShowModal(false);
    setMessageToDelete(null); // Reset message to delete
  };

  // Redirect if not authenticated
  const openDeleteAllModal = () => {
    setShowDeleteAllModal(true);
  };
  const closeDeleteAllModal = () => {
    setShowDeleteAllModal(false);
  };
  const handleDeleteAll = async () => {
    try {
      await axios.put(
        "http://localhost:4000/api/v1/message/deleteall",
        {}, // Empty body
        { withCredentials: true }
      );
      setMessages([]); // Clear the messages array
      setShowDeleteAllModal(false);
      toast.success("All messages deleted!");
    } catch (error) {
      toast.error("Failed to delete all messages!");
      setShowDeleteAllModal(false);
    }
  };
  if (!isAuthenticated) {
    return <Navigate to={"/login"} />;
  }
  return (
    <section className="page messages">
      <h1>MESSAGES</h1>
      <div className="message-actions">
        {messages.length > 0 && (
          <>
            <button className="btn mark-all" onClick={handleMarkAllAsRead}>
              Mark All as Read
            </button>
            <button className="btn delete-all" onClick={openDeleteAllModal}>
              Delete All Messages
            </button>
          </>
        )}
      </div>
      <div className="banner">
        {messages && messages.length > 0 ? (
          messages.map((element) => {
            return (
              <div
                className={`card ${element.isRead ? "faint" : ""}`}
                key={element._id}
              >
                <div className="details">
                  <p>
                    First Name: <span>{element.firstName}</span>
                  </p>
                  <p>
                    Last Name: <span>{element.lastName}</span>
                  </p>
                  <p>
                    Email: <span>{element.email}</span>
                  </p>
                  <p>
                    Phone: <span>{element.phone}</span>
                  </p>
                  <p>
                    Message: <span>{element.message}</span>
                  </p>
                </div>
                <div className="message-btn">
                  <button
                    className="mark btn"
                    onClick={() => handleMarkAsRead(element._id)}
                    disabled={element.isRead} // Disable if already read
                  >
                    Mark as Read
                  </button>
                  <button
                    className="del btn"
                    onClick={() => openDeleteModal(element._id)} // Open modal for delete
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <h1>No Messages!</h1>
        )}
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <p>Are you sure you want to delete this message?</p>
            <div className="modal-actions message-btn">
              <button className="del action" onClick={handleDelete}>
                OK
              </button>
              <button className="mark action" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete All Confirmation Modal */}
      {showDeleteAllModal && (
        <div className="modal-overlay">
          <div className="modal">
            <p>Are you sure you want to delete all messages?</p>
            <div className="modal-actions">
              <button className="btn confirm" onClick={handleDeleteAll}>
                OK
              </button>
              <button className="btn cancel" onClick={closeDeleteAllModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Messages;
