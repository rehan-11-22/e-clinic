import React from "react";
import Hero from "../components/Hero";
import AppointmentForm from "../components/AppointmentForm";

const Appointment = () => {
  return (
    <>
      <Hero
        title={"Schedule Your Appointment at E-Cure Hub"}
        imageUrl={"/appointment.png"}
        paragrapgh={
          "Welcome to the Appointments section of E-Cure Hub! Here, you can quickly find and schedule appointments with trusted healthcare professionals across a wide range of specialties. Whether you're looking for a general consultation or a specific expert, our platform makes it easy to choose a time that works for you. With just a few clicks, you’re on your way to personalized care—convenient, fast, and right at your fingertips."
        }
      />
      <AppointmentForm />
    </>
  );
};

export default Appointment;
