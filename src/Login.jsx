import React, { useState } from "react";
import "./css/login.css";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Nav from "./Components/Nav";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post("http://localhost:3001/login", {
        email,
        password,
      });

      const { token, role, username, email: userEmail } = response.data;
      localStorage.setItem("token", token);
      localStorage.setItem("role", role);
      localStorage.setItem("username", username);
      localStorage.setItem("email", userEmail);
      localStorage.removeItem("banInfo");

      if (role === "participant") {
        navigate("/participant");
      } else if (role === "coordinator") {
        navigate("/coordinator");
      } else if (role === "admin") {
        navigate("/admin");
      }
    } catch (error) {
      const statusCode = error?.response?.status;
      const payload = error?.response?.data || {};
      const message = payload?.error || "Login failed";
      const isBanError = statusCode === 403 && message.toLowerCase().includes("banned");

      if (isBanError) {
        const banInfo = {
          message,
          permanent: Boolean(payload?.permanent),
          bannedUntil: payload?.bannedUntil || null,
          banReason: payload?.banReason || "",
        };
        localStorage.setItem("banInfo", JSON.stringify(banInfo));
        navigate("/banned", { state: banInfo });
        return;
      }

      alert(message);
    }
  };

  return (
    <>
      <Nav />
      <div className="login-page">
        <div className="login-container">
          <h2>Login</h2>

          <form onSubmit={handleLogin}>
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

            <button type="submit">LOGIN</button>
          </form>
        </div>
      </div>
    </>
  );
}

export default Login;
