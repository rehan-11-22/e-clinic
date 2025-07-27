import React from "react";
import Hero from "../components/Hero";
import Biography from "../components/Biography";
import Doctors from "../components/Doctors";
const AboutUs = () => {
  return (
    <>
      <Hero
        title={"Learn More About Us | E-Cure Hub"}
        imageUrl={"/about-us2.png"}
        paragrapgh={
          "At E-Cure Hub, We are redefining how people connect with healthcare. As a digital first platform, we focus on making medical support accessible, fast, and user friendly. From booking appointments with trusted doctors to getting instant answers through our smart chatbot, everything is designed to put your health needs first. We are not a clinic we are your online healthcare companion, here to guide you at every step of your wellness journey, anytime and anywhere."
        }
      />
      <Biography imageUrl={"/bio.jpeg"} />
      <Doctors />
    </>
  );
};

export default AboutUs;
