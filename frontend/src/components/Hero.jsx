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
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/medical-query`, {
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
      <div className="hero container">
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
    </div>
  );
};

export default Hero;
