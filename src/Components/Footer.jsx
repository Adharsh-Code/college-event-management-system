import React from "react";
import { Link } from "react-router-dom";
import "../css/footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">

        <div className="footer-section">
          <h3>Event Management</h3>
          <p>
            A centralized platform to manage, organize, and participate in
            events efficiently.
          </p>
        </div>

        <div className="footer-section">
          <h4>Quick Links</h4>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/AboutUS">About Us</Link></li>
            <li><Link to="/Login">Login</Link></li>
            <li><Link to="/RegisterParticipant">Register</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Contact</h4>
          <p>Email: admin@gmail.com</p>
          <p>Phone: +91&nbsp;01234&nbsp;56789</p>
        </div>

      </div>

      <div className="footer-bottom">
        &copy; {new Date().getFullYear()} Event Management System. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;

