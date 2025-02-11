import React from "react";
import Hero from "../components/Hero";
import Biography from "../components/Biography";
import MessageForm from "../components/MessageForm";
const ContactUs = () => {
  return (
    <>
      <Hero
        title={"Learn More Contact Us | ZeeCare Medical Institute"}
        imageUrl={"/contactus.png"}
      />
      <Biography imageUrl={"/whoweare.png"} />
      <MessageForm />
    </>
  );
};

export default ContactUs;
