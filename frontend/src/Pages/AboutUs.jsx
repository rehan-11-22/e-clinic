import React from "react";
import Hero from "../components/Hero";
import Biography from "../components/Biography";
import Doctors from "../components/Doctors";
const AboutUs = () => {
  return (
    <>
      <Hero
        title={"Learn More About Us | ZeeCare Medical Institute"}
        imageUrl={"/about.png"}
      />
      <Biography imageUrl={"/whoweare.png"} />
      <Doctors />
    </>
  );
};

export default AboutUs;
