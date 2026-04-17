import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "../../Components/sidebars/AdminSidebar.jsx";
import "./css/AdminLayout.css";

function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="dashboard-container">
      <button
        type="button"
        className={`admin-sidebar-toggle ${isSidebarOpen ? "is-open" : ""}`}
        onClick={() => setIsSidebarOpen((prev) => !prev)}
      >
        {isSidebarOpen ? "Close Menu" : "Menu"}
      </button>

      {isSidebarOpen ? (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <AdminSidebar
        isOpen={isSidebarOpen}
        onNavigate={() => setIsSidebarOpen(false)}
      />
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
