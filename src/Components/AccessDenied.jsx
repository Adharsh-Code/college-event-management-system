import React from "react";
import { useNavigate } from "react-router-dom";
import "./AccessDenied.css";

function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div className="access-denied-page">
      <div className="access-denied-container">
        <div className="access-denied-content">
          <h1>Access Denied</h1>
          <p>You do not have permission to view this page.</p>
          <button onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    </div>
  );
}

export default AccessDenied;