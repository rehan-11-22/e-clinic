// ChatBot.js
import React, { useState } from "react";
import { mockChatMessages } from "./mockChatData";

const ChatBot = ({ onClose }) => {
  const [messages] = useState(mockChatMessages);
  const [input, setInput] = useState("");

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h4>ZeeCare Assistant</h4>
        <button className="chatbot-close" onClick={onClose}>
          <img src="/chatbot_icon.png" alt="close" />
        </button>
      </div>
      <div className="chatbot-body">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.from}`}>
            {msg.message}
          </div>
        ))}
      </div>
      <div className="chatbot-input">
        <input
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </div>
    </div>
  );
};

export default ChatBot;
