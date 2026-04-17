import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import CoordinatorSidebar from "../../Components/sidebars/CoordinatorSidebar.jsx";
import "./css/CoordinatorLayout.css";

function CoordinatorLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="dashboard-container">
      <button
        type="button"
        className={`coordinator-sidebar-toggle ${isSidebarOpen ? "is-open" : ""}`}
        onClick={() => setIsSidebarOpen((prev) => !prev)}
      >
        {isSidebarOpen ? "Close Menu" : "Menu"}
      </button>

      {isSidebarOpen ? (
        <button
          type="button"
          className="coordinator-sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <CoordinatorSidebar
        isOpen={isSidebarOpen}
        onNavigate={() => setIsSidebarOpen(false)}
      />
      <main className="coordinator-main">
        <Outlet />
      </main>
    </div>
  );
}

export default CoordinatorLayout;
