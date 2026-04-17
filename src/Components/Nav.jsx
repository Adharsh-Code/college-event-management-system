import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../css/nav.css";
import logo from "../assets/img/logo.png";

function Nav() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  /* Close dropdown when clicking outside */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-container">

        {/* Left section */}
        <div className="navbar-left">
          {/* Optional logo */}
          {/* <img src={logo} alt="College Logo" className="navbar-logo" /> */}

          <h1 className="navbar-title">CeM</h1>

          <ul className="navbar-menu">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/AboutUS">About Us</Link></li>
            {/* <li><Link to="/Events">Events</Link></li> */}
          </ul>
        </div>

        {/* Right section */}
        <div className="navbar-right">

          <button
            className="primary-btn"
            onClick={() => navigate("/Login")}
          >
            Login
          </button>

          <div className="register-dropdown" ref={dropdownRef}>
            <button
              className="secondary-btn"
              onClick={() => setOpen(prev => !prev)}
              aria-haspopup="true"
              aria-expanded={open}
            >
              Register
            </button>

            {open && (
              <div className="dropdown-menu">
                <button onClick={() => navigate("/RegisterParticipant")}>
                  Participant
                </button>
                <button onClick={() => navigate("/RegisterCoordinator")}>
                  Coordinator
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </nav>
  );
}

export default Nav;
