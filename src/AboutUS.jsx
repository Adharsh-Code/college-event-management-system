import React from "react";
import "./css/aboutus.css";
import Footer from "./Components/Footer";
import Nav from './Components/Nav'

function About() {
  return (
    <>
    <Nav/>
    <section className="about-page">
      <div className="about-container">
        <h1>About Us</h1>

        <div className="about-section">
          <h3>Our Mission</h3>
          <p>
            Our mission is to simplify event management by providing a unified
            platform that supports organizers, coordinators, and participants
            throughout the entire event lifecycle.
          </p>
        </div>

        <div className="about-section">
          <h3>What We Offer</h3>
          <ul>
            <li>Structured event creation and scheduling</li>
            <li>Secure online participant registration</li>
            <li>Efficient coordinator and role management</li>
            <li>Automated certificate generation and reporting</li>
          </ul>
        </div>
      </div>
      
    </section>
    <Footer />
    </>  
  );
}

export default About;

