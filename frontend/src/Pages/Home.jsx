import React, { useContext } from "react";
import Hero from "../components/Hero";
import Biography from "../components/Biography";
import MessageForm from "../components/MessageForm";
import Departments from "../components/Departments";

const Home = () => {
  return (
    <>
      <Hero
        title={"Welcome to E-Cure Hub | Your Trusted Healthcare Provider"}
        imageUrl={"/banner.png"}
        paragrapgh={
          "E-Cure Hub Medical is an advanced online platform designed to simplify your healthcare journey. Whether you're booking appointments or seeking instant support through our smart chatbot, ZeeCare is here to make quality healthcare more accessible. Our network of trusted medical professionals is committed to providing personalized care, ensuring you get the guidance and attention you deserve—right from the comfort of your home."
        }
      />
      <Biography imageUrl={"/bio2.jpg"} />
      <Departments />
      {/* <MessageForm /> */}
    </>
  );
};

export default Home;
