import React from "react";
import Hero from "../components/Hero";
import Biography from "../components/Biography";
import MessageForm from "../components/MessageForm";
const ContactUs = () => {
  return (
    <>
      <Hero
        title={"Learn More Contact Us | ZeeCare Medical Institute"}
        imageUrl={"/contact-us.png"}
        paragrapgh={
          "Have a question, need assistance, or want to share feedback? We’re here to help! At E-Cure Hub Medical, your satisfaction and well-being are our top priorities. Whether it’s about booking appointments, using our chatbot, or anything else, feel free to reach out. Our support team is always ready to assist you and ensure you have a smooth experience on our platform."
        }
      />
      <Biography imageUrl={"/bio.jpeg"} />
      <MessageForm />
    </>
  );
};

export default ContactUs;
