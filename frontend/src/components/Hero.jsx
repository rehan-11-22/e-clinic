import React, { useState, useEffect, useRef } from "react";
import { Send, Mic, MicOff, X } from "lucide-react";

const Hero = ({ title, imageUrl, paragrapgh }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Load messages from sessionStorage on component mount
  useEffect(() => {
    const savedMessages = sessionStorage.getItem("zeecare-chat-messages");
    const savedChatState = sessionStorage.getItem("zeecare-chat-open");

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (error) {
        console.error("Error parsing saved messages:", error);
      }
    }

    if (savedChatState === "true") {
      setIsChatOpen(true);
    }
  }, []);

  // Save messages to sessionStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem("zeecare-chat-messages", JSON.stringify(messages));
    }
  }, [messages]);

  // Save chat open state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("zeecare-chat-open", isChatOpen.toString());
  }, [isChatOpen]);

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const clearChat = () => {
    setMessages([]);
    sessionStorage.removeItem("zeecare-chat-messages");
  };

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + " " + transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    const timeout = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    return () => clearTimeout(timeout);
  }, [messages]);

  const toggleSpeechRecognition = () => {
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        setIsListening(false);
      }
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { id: Date.now(), role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:4000/api/medical-query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: input }),
      });

      if (!res.ok) throw new Error("Failed to fetch data");

      const data = await res.json();

      const assistantMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: data.answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Query error:", err);
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
      setInput("");
      inputRef.current?.focus();
    }
  };

  return (
    <div className="hero-wrapper">
      <div className="hero container" style={{ overflowY: "hidden" }}>
        <div className="banner">
          <h1>{title}</h1>
          <p>{paragrapgh}</p>
        </div>
        <div className="banner">
          <img src={imageUrl} alt="hero" className="animated-image" />
          <span>
            <img src="/Vector.png" alt="vector" />
          </span>
        </div>
      </div>

      {/* Fixed Chat Icon */}
      <div className="zeecare-chat-icon" onClick={toggleChat}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="#ffffff"
        >
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
      </div>

      {/* Chat Modal */}
      {isChatOpen && (
        <div className="zeecare-chat-modal">
          <div className="zeecare-chat-modal-content">
            <div className="zeecare-chat-modal-header">
              <h3>E-Cure Medical Assistant</h3>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                {messages.length > 0 && (
                  <button
                    className="zeecare-clear-btn"
                    onClick={clearChat}
                    title="Clear chat history"
                  >
                    Clear
                  </button>
                )}
                <button className="zeecare-close-btn" onClick={toggleChat}>
                  <X size={20} color="white" />
                </button>
              </div>
            </div>

            <div className="zeecare-chat-modal-body">
              {/* Messages Area */}
              <div className="zeecare-messages-container">
                {messages.length === 0 ? (
                  <div className="zeecare-welcome-message">
                    <p>
                      Hi! I'm your E-Cure medical assistant. I can help you
                      with:
                    </p>
                    <ul>
                      <li>💊 Medical information</li>
                      <li>❓ General healthcare questions</li>
                    </ul>
                    <p>
                      <strong>Try asking:</strong> "What are the symptoms of
                      diabetes?" or "What is hypertension?"
                    </p>
                  </div>
                ) : (
                  <div className="zeecare-messages">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`zeecare-message ${
                          message.role === "user" ? "user" : "assistant"
                        }`}
                      >
                        <div className="zeecare-message-content">
                          {message.content}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="zeecare-message assistant">
                        <div className="zeecare-message-content zeecare-loading">
                          <span className="zeecare-typing-indicator">⚡</span>
                          Processing query...
                        </div>
                      </div>
                    )}
                    {error && (
                      <div className="zeecare-message error">
                        <div className="zeecare-message-content">
                          Error: {error}
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <form onSubmit={handleSubmit} className="zeecare-chat-input-form">
                <div className="zeecare-input-wrapper">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about medical information..."
                    disabled={isLoading}
                    className="zeecare-text-input"
                  />
                  <div className="zeecare-input-buttons">
                    <button
                      type="button"
                      onClick={toggleSpeechRecognition}
                      disabled={
                        !(
                          "webkitSpeechRecognition" in window ||
                          "SpeechRecognition" in window
                        )
                      }
                      className={`zeecare-mic-btn ${
                        isListening ? "listening" : ""
                      }`}
                      title={
                        isListening ? "Stop listening" : "Start voice input"
                      }
                    >
                      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      className="zeecare-send-btn"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
                {isListening && (
                  <div className="zeecare-listening-indicator">
                    <span className="zeecare-pulse">●</span> Listening...
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* Hero-specific styles remain unchanged */

        /* Enhanced chatbot styles */
        .zeecare-chat-icon {
          position: fixed;
          bottom: 30px;
          right: 30px;
          width: 60px;
          height: 60px;
          background-color: #4a6bff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          z-index: 1000;
          transition: all 0.3s ease;
        }

        .zeecare-chat-icon:hover {
          transform: scale(1.1);
          background-color: #3a5bef;
        }

        .zeecare-chat-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          z-index: 1001;
        }

        .zeecare-chat-modal-content {
          width: 90%;
          max-width: 450px;
          height: 85%;
          max-height: 650px;
          margin-right: 30px;
          background-color: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
        }

        .zeecare-chat-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: linear-gradient(135deg, #4a6bff 0%, #3a5bef 100%);
          color: white;
        }

        .zeecare-chat-modal-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .zeecare-clear-btn {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .zeecare-clear-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .zeecare-close-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .zeecare-close-btn:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }

        .zeecare-chat-modal-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .zeecare-messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .zeecare-welcome-message {
          color: #374151;
          font-size: 14px;
          line-height: 1.6;
          padding: 20px;
          background: linear-gradient(135deg, #f8faff 0%, #f1f5ff 100%);
          border-radius: 12px;
          margin: 10px 0;
        }

        .zeecare-welcome-message p:first-child {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 16px;
          text-align: center;
        }

        .zeecare-welcome-message ul {
          background: white;
          border-radius: 8px;
          padding: 16px 20px;
          margin: 16px 0;
          border-left: 4px solid #4a6bff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .zeecare-welcome-message li {
          margin: 8px 0;
          color: #4b5563;
          font-size: 13px;
        }

        .zeecare-welcome-message p:last-child {
          margin-top: 16px;
          padding: 12px;
          background: white;
          border-radius: 8px;
          font-size: 13px;
          color: #6b7280;
          border: 1px solid #e5e7eb;
        }

        .zeecare-messages {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .zeecare-message {
          display: flex;
        }

        .zeecare-message.user {
          justify-content: flex-end;
        }

        .zeecare-message.assistant {
          justify-content: flex-start;
        }

        .zeecare-message.error {
          justify-content: center;
        }

        .zeecare-message-content {
          max-width: 80%;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 13px;
          line-height: 1.4;
          word-wrap: break-word;
        }

        .zeecare-message.user .zeecare-message-content {
          background-color: #4a6bff;
          color: white;
          border-bottom-right-radius: 4px;
        }

        .zeecare-message.assistant .zeecare-message-content {
          background-color: #f1f3f4;
          color: #333;
          border-bottom-left-radius: 4px;
        }

        .zeecare-message.error .zeecare-message-content {
          background-color: #fee;
          color: #c53030;
          border: 1px solid #fed7d7;
        }

        .zeecare-loading .zeecare-typing-indicator {
          animation: pulse 1.5s infinite;
          margin-right: 8px;
        }

        .zeecare-chat-input-form {
          padding: 16px;
          border-top: 1px solid #e5e7eb;
          background-color: #fafafa;
        }

        .zeecare-input-wrapper {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }

        .zeecare-text-input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 20px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
          resize: none;
        }

        .zeecare-text-input:focus {
          border-color: #4a6bff;
          box-shadow: 0 0 0 3px rgba(74, 107, 255, 0.1);
        }

        .zeecare-text-input:disabled {
          background-color: #f9fafb;
          opacity: 0.7;
        }

        .zeecare-input-buttons {
          display: flex;
          gap: 4px;
        }

        .zeecare-mic-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background-color: #f1f3f4;
          color: #666;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .zeecare-mic-btn:hover {
          background-color: #e5e7eb;
        }

        .zeecare-mic-btn.listening {
          background-color: #ef4444;
          color: white;
        }

        .zeecare-mic-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .zeecare-send-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background-color: #4a6bff;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
        }

        .zeecare-send-btn:hover:not(:disabled) {
          background-color: #3a5bef;
        }

        .zeecare-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .zeecare-listening-indicator {
          margin-top: 8px;
          font-size: 11px;
          color: #4a6bff;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .zeecare-pulse {
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }

        @media (max-width: 768px) {
          .zeecare-chat-icon {
            width: 50px;
            height: 50px;
            bottom: 20px;
            right: 20px;
          }

          .zeecare-chat-modal-content {
            width: 95%;
            height: 80%;
            margin-right: 10px;
          }

          .zeecare-message-content {
            max-width: 90%;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default Hero;
