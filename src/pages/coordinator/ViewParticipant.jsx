import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./css/ViewParticipant.css";

function ViewParticipant() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("You must be logged in to view users");
      setLoading(false);
      return;
    }

    axios.get("http://localhost:3001/coordinator/participants", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        // Filter only participants
        const filtered = res.data.filter(u => u.role === "participant");
        setUsers(filtered);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err.response || err);
        setError("Failed to fetch users");
        setLoading(false);
      });
  }, []);

  const handleReport = (userId) => {
    navigate(`/coordinator/report/${userId}`);
  };

  const handleViewDetails = async (userId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      setDetailsError("You must be logged in to view details.");
      return;
    }

    try {
      setDetailsLoading(true);
      setDetailsError("");
      const { data } = await axios.get(`http://localhost:3001/coordinator/participants/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedParticipant(data);
    } catch (err) {
      console.error(err.response || err);
      setDetailsError("Failed to fetch participant details.");
      setSelectedParticipant(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedParticipant(null);
    setDetailsError("");
  };

  const getUserStatus = (user) => {
    if (!user?.isBanned || (user.bannedUntil && new Date(user.bannedUntil) < new Date())) {
      return { label: "Active", className: "vp-status-active", detail: "" };
    }

    if (!user?.bannedUntil) {
      return {
        label: "Permanently Banned",
        className: "vp-status-banned-permanent",
        detail: "",
      };
    }

    return {
      label: "Temporarily Banned",
      className: "vp-status-banned-temporary",
      detail: `Until ${new Date(user.bannedUntil).toLocaleString()}`,
    };
  };

  const filteredUsers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    let result = users.filter((user) => {
      if (!search) return true;
      return (
        user?.username?.toLowerCase().includes(search) ||
        user?.email?.toLowerCase().includes(search) ||
        user?.fullName?.toLowerCase().includes(search) ||
        user?.department?.toLowerCase().includes(search)
      );
    });

    result = [...result];
    if (sortBy === "name-asc") {
      result.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
    } else if (sortBy === "name-desc") {
      result.sort((a, b) => (b.username || "").localeCompare(a.username || ""));
    } else if (sortBy === "email-asc") {
      result.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
    } else if (sortBy === "email-desc") {
      result.sort((a, b) => (b.email || "").localeCompare(a.email || ""));
    } else if (sortBy === "status") {
      const rank = (user) => {
        if (!user?.isBanned) return 0;
        if (!user?.bannedUntil) return 2;
        return 1;
      };
      result.sort((a, b) => rank(b) - rank(a));
    }

    return result;
  }, [users, searchTerm, sortBy]);

  return (
    <div className="view-user-page">
      <div className="view-user-header">
        <h2 className="page-title">Participants List</h2>
        <p>Review registered participants, search quickly, and open details or report actions.</p>
      </div>

      {error ? <div className="vp-feedback vp-feedback-error">{error}</div> : null}
      {detailsError && !selectedParticipant ? (
        <div className="vp-feedback vp-feedback-error">{detailsError}</div>
      ) : null}

      <div className="view-user-panel">
        <div className="participant-controls">
          <input
            type="text"
            className="participant-search"
            placeholder="Search by name, email, full name, department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="participant-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="email-asc">Email A-Z</option>
            <option value="email-desc">Email Z-A</option>
            <option value="status">Status (Banned First)</option>
          </select>
        </div>

        {loading ? (
          <div className="vp-state">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="vp-state">No users found.</div>
        ) : (
          <div className="table-wrapper">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const status = getUserStatus(u);
                  return (
                    <tr key={u._id}>
                      <td>{u.username}</td>
                      <td>{u.email}</td>
                      <td className="vp-status-cell">
                        <span className={`vp-status-badge ${status.className}`}>{status.label}</span>
                        {status.detail ? <div className="vp-status-detail">{status.detail}</div> : null}
                      </td>
                      <td>
                        <div className="action-btn-group">
                          <button
                            className="details-btn"
                            onClick={() => handleViewDetails(u._id)}
                          >
                            Details
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => handleReport(u._id)}
                          >
                            Report
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="no-results-cell">
                      No participants found for the current search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(selectedParticipant || detailsLoading || detailsError) ? (
        <div className="participant-details-modal-backdrop" onClick={closeDetails}>
          <div className="participant-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="participant-details-header">
              <h3>Details</h3>
              <button type="button" className="close-modal-btn" onClick={closeDetails}>
                Close
              </button>
            </div>

            {detailsLoading ? (
              <p>Loading details...</p>
            ) : detailsError ? (
              <p className="details-error">{detailsError}</p>
            ) : selectedParticipant ? (
              <div className="participant-details-grid">
                <p><strong>Username:</strong> {selectedParticipant.username || "N/A"}</p>
                <p><strong>Full Name:</strong> {selectedParticipant.fullName || "N/A"}</p>
                <p><strong>Email:</strong> {selectedParticipant.email || "N/A"}</p>
                <p><strong>Phone:</strong> {selectedParticipant.phone || "N/A"}</p>
                <p><strong>Department:</strong> {selectedParticipant.department || "N/A"}</p>
                <p><strong>Year:</strong> {selectedParticipant.year || "N/A"}</p>
                <p><strong>Status:</strong> {getUserStatus(selectedParticipant).label}</p>
                {selectedParticipant?.isBanned && selectedParticipant?.bannedUntil ? (
                  <p>
                    <strong>Ban Ends:</strong> {new Date(selectedParticipant.bannedUntil).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ViewParticipant;
