import React, { useState } from "react";
import "./css/login.css";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Nav from "./Components/Nav";

function RegisterParticipant() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const navigate = useNavigate();

  const registerParticipant = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      return alert("Passwords do not match");
    }

    try {
      const response = await axios.post("http://localhost:3001/register", {
        username,
        email,
        password,
        role: "participant",
      });

      console.log("Registration successful:", response.data);
      navigate("/participant");
    } catch (error) {
      console.error(
        "Registration failed:",
        error.response?.data?.error || error.message
      );
    }
  };

  return (
    <>
    <Nav/>
    <div className="login-page">
      <div className="login-container">
        <h2>Participant Registration</h2>

        <form onSubmit={registerParticipant}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Username"
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <input
              type="email"
              placeholder="Email"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <input
              type="password"
              placeholder="Confirm Password"
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit">REGISTER</button>
        </form>
      </div>
    </div>
    </>
  );
}

export default RegisterParticipant;
