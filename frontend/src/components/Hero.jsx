import React, { useState } from "react";

const Hero = ({ title, imageUrl }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  return (
    <div className="hero-wrapper">
      <div className="hero container" style={{ overflowY: "hidden" }}>
        <div className="banner">
          <h1>{title}</h1>
          <p>
            ZeeCare Medical Institute is a state-of-the-art facility dedicated
            to providing comprehensive healthcare services with compassion and
            expertise. Our team of skilled professionals is committed to
            delivering personalized care tailored to each patient's needs. At
            ZeeCare, we prioritize your well-being, ensuring a harmonious
            journey towards optimal health and wellness.
          </p>
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
              <h3>Zee Assistant (Beta)</h3>
              <button className="zeecare-close-btn" onClick={toggleChat}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="#000000"
                >
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <div className="zeecare-chat-modal-body">
              <p>
                Hi, I'm ZeeCare's virtual assistant. I can answer common
                questions & help you around our site. I am still in development
                and learning how to best offer guidance. I can not assist with
                scheduling your appointment or access your account details if
                you are a current patient.
              </p>

              <p>
                If you are a current patient or you need to talk to a person at
                Brightside immediately, please call +1 833 910 0702.
              </p>

              <p>Otherwise, here are some ways to get started:</p>

              <div className="zeecare-chat-options">
                <div className="zeecare-chat-option">
                  <input type="checkbox" id="zeecare-option1" />
                  <label htmlFor="zeecare-option1">How do I get started?</label>
                </div>
                <div className="zeecare-chat-option">
                  <input type="checkbox" id="zeecare-option2" defaultChecked />
                  <label htmlFor="zeecare-option2">Terms of Service</label>
                </div>
              </div>

              <div className="zeecare-chat-input">
                <input type="text" placeholder="Type your message here..." />
                <button className="zeecare-send-btn">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="#ffffff"
                  >
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* Hero-specific styles remain unchanged */

        /* Namespaced chatbot styles to avoid conflicts */
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
          max-width: 400px;
          height: 80%;
          max-height: 600px;
          margin-right: 30px;
          background-color: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
        }

        .zeecare-chat-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          background-color: #4a6bff;
          color: white;
        }

        .zeecare-chat-modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
        }

        .zeecare-close-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .zeecare-close-btn svg {
          fill: white;
        }

        .zeecare-chat-modal-body {
          padding: 20px;
          flex: 1;
          overflow-y: auto;
        }

        .zeecare-chat-modal-body p {
          margin-bottom: 15px;
          font-size: 14px;
          line-height: 1.5;
        }

        .zeecare-chat-options {
          margin: 20px 0;
        }

        .zeecare-chat-option {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
        }

        .zeecare-chat-option input {
          margin-right: 10px;
        }

        .zeecare-chat-input {
          display: flex;
          margin-top: 20px;
        }

        .zeecare-chat-input input {
          flex: 1;
          padding: 10px 15px;
          border: 1px solid #ddd;
          border-radius: 5px;
          font-size: 14px;
        }

        .zeecare-send-btn {
          background-color: #4a6bff;
          border: none;
          border-radius: 5px;
          padding: 0 15px;
          margin-left: 10px;
          cursor: pointer;
          transition: background-color 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .zeecare-send-btn:hover {
          background-color: #3a5bef;
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
            margin-right: 10px;
            height: 70%;
          }
        }
      `}</style>
    </div>
  );
};

export default Hero;
