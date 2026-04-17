import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import ParticipantSidebar from "../../Components/sidebars/ParticipantSidebar.jsx";
import "./css/ParticipantLayout.css";

function ParticipantLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="dashboard-container">
      <button
        type="button"
        className={`participant-sidebar-toggle ${isSidebarOpen ? "is-open" : ""}`}
        onClick={() => setIsSidebarOpen((prev) => !prev)}
      >
        {isSidebarOpen ? "Close Menu" : "Menu"}
      </button>

      {isSidebarOpen ? (
        <button
          type="button"
          className="participant-sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <ParticipantSidebar
        isOpen={isSidebarOpen}
        onNavigate={() => setIsSidebarOpen(false)}
      />
      <main className="participant-main">
        <Outlet />
      </main>
    </div>
  );
}

export default ParticipantLayout;
