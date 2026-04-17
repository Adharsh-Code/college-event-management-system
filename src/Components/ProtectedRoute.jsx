import React from "react";
import { Navigate } from "react-router-dom";
import AccessDenied from "./AccessDenied";

function ProtectedRoute({ children, role: requiredRole }) {
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role");

  // Not logged in
  if (!token) {
    return <Navigate to="/login" />;
  }

  // Role not authorized
  if (requiredRole && userRole !== requiredRole) {
    return <AccessDenied />;
  }

  return children;
}

export default ProtectedRoute;
