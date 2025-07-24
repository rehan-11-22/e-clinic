import React from "react";

const Biography = ({ imageUrl }) => {
  return (
    <>
      <div className="container biography">
        <div className="banner">
          <img src={imageUrl} alt="whoweare" />
        </div>
        <div className="banner">
          <p>Biography</p>
          <h3>Who We Are</h3>
          <p>
            E-Cure Hub is a digital healthcare platform dedicated to simplifying
            how people access medical support. Built with the vision of making
            healthcare more accessible and efficient, E-Cure Hub allows users to
            seamlessly book doctor appointments online and receive instant
            guidance through an intelligent, AI-powered chatbot.
          </p>
          <p>
            Founded on the principles of trust, innovation, and patient-centric
            care, E-Cure Hub connects individuals with certified healthcare
            professionals across various specialties—right from the comfort of
            their home. Whether you're looking for the right doctor, need help
            understanding symptoms, or simply want quick answers, E-Cure Hub is
            your reliable virtual companion in your health journey.
          </p>
          <p>
            E-Cure Hub Medical continues to evolve as a smart, secure, and
            user-friendly digital solution designed for modern healthcare needs.
          </p>
        </div>
      </div>
    </>
  );
};

export default Biography;
