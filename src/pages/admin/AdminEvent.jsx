import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./css/AdminEvent.css";

function AdminEvent() {
  const API_BASE = "http://localhost:3001";
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      setError("");
      const [eventsRes, usersRes] = await Promise.all([
        axios.get("http://localhost:3001/events", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get("http://localhost:3001/users", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch events.");
    } finally {
      setLoading(false);
    }
  };

  const getEventStatus = (event) => {
    const now = new Date();
    const startDate = new Date(event.date);
    const endDate = new Date(event.endDate || event.date);
    const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : null;

    if (event.endedAt) return "ended";
    if (endDate <= now) return "past";
    if (startDate <= now && endDate > now) return "ongoing";
    if (deadline && deadline > now && startDate > now) return "registration_open";
    return "upcoming";
  };

  const getEventStatusLabel = (event) => {
    const status = getEventStatus(event);
    if (status === "registration_open") return "Registration Open";
    if (status === "ongoing") return "Ongoing";
    if (status === "upcoming") return "Upcoming";
    if (status === "ended") return "Ended";
    return "Past";
  };

  const filteredEvents = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    let result = events.filter((event) => {
      const status = getEventStatus(event);
      const matchesSearch =
        event.title?.toLowerCase().includes(search) ||
        event.venue?.toLowerCase().includes(search) ||
        event.description?.toLowerCase().includes(search) ||
        event.createdBy?.username?.toLowerCase().includes(search);
      const matchesStatus = statusFilter === "all" ? true : status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    result = [...result];
    if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortBy === "oldest") {
      result.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    } else if (sortBy === "dateSoon") {
      result.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    } else if (sortBy === "dateFar") {
      result.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }

    return result;
  }, [events, searchTerm, statusFilter, sortBy]);

  const stats = useMemo(() => {
    const now = new Date();
    const upcoming = events.filter((event) => {
      if (event.endedAt) return false;
      return new Date(event.date) > now;
    }).length;
    const ongoing = events.filter((event) => {
      if (event.endedAt) return false;
      const startDate = new Date(event.date);
      const endDate = new Date(event.endDate || event.date);
      return startDate <= now && endDate > now;
    }).length;
    const ended = events.filter((event) => Boolean(event.endedAt)).length;
    const past = events.filter((event) => {
      if (event.endedAt) return false;
      return new Date(event.endDate || event.date) <= now;
    }).length;
    const openRegistration = events.filter(
      (event) =>
        !event.endedAt &&
        new Date(event.date) > now &&
        event.registrationDeadline &&
        new Date(event.registrationDeadline) > now
    ).length;

    return {
      total: events.length,
      upcoming,
      ongoing,
      openRegistration,
      past,
      ended,
    };
  }, [events]);

  const userMap = useMemo(
    () => new Map(users.map((user) => [String(user._id), user])),
    [users]
  );

  const handleDelete = async (eventId) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;

    const token = localStorage.getItem("token");
    try {
      setDeletingId(eventId);
      await axios.delete(`http://localhost:3001/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEvents((prev) => prev.filter((event) => event._id !== eventId));
      setMessage("Event deleted successfully.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to delete event.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
  };

  const getUserImageUrl = (user) => {
    if (user?.profileImage && user.profileImage !== "default.png") {
      return `${API_BASE}/uploads/${user.profileImage}`;
    }
    return `${API_BASE}/uploads/default.png`;
  };

  const selectedEventAttendees = useMemo(() => {
    if (!selectedEvent?.attendees?.length) return [];

    return selectedEvent.attendees.map((attendee) => {
      const participantId =
        typeof attendee.user === "string" ? attendee.user : attendee.user?._id || attendee.user;
      return {
        ...attendee,
        participantId: String(participantId || ""),
        participant: userMap.get(String(participantId || "")) || null,
      };
    });
  }, [selectedEvent, userMap]);

  return (
    <div className="admin-event-page">
      <div className="admin-event-header">
        <div>
          <h2 className="page-title">Manage Events</h2>
          <p className="page-subtitle">Review published events.</p>
        </div>
        <div className="event-stats">
          <div className="event-stat-chip">
            <span>{stats.total}</span>
            <small>Total</small>
          </div>
          <div className="event-stat-chip">
            <span>{stats.upcoming}</span>
            <small>Upcoming</small>
          </div>
          <div className="event-stat-chip">
            <span>{stats.ongoing}</span>
            <small>Ongoing</small>
          </div>
          <div className="event-stat-chip">
            <span>{stats.openRegistration}</span>
            <small>Open Reg</small>
          </div>
          <div className="event-stat-chip">
            <span>{stats.ended}</span>
            <small>Ended</small>
          </div>
          <div className="event-stat-chip">
            <span>{stats.past}</span>
            <small>Past</small>
          </div>
        </div>
      </div>

      <div className="event-controls">
        <input
          type="text"
          className="event-search"
          placeholder="Search by title, venue, description, coordinator..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="event-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All status</option>
          <option value="ongoing">Ongoing</option>
          <option value="registration_open">Registration Open</option>
          <option value="upcoming">Upcoming</option>
          <option value="ended">Ended</option>
          <option value="past">Past</option>
        </select>
        <select
          className="event-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="newest">Newest Created</option>
          <option value="oldest">Oldest Created</option>
          <option value="dateSoon">Event Date (Soonest)</option>
          <option value="dateFar">Event Date (Latest)</option>
        </select>
      </div>

      {message ? <div className="event-message">{message}</div> : null}

      <div className="table-wrapper">
        {loading ? (
          <div className="state-box">Loading events...</div>
        ) : error ? (
          <div className="state-box error">
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchEvents}>
              Retry
            </button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="state-box">No events found for current filters.</div>
        ) : (
          <table className="event-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Venue</th>
                <th>Status</th>
                <th>Coordinator</th>
                <th>Poster</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr key={event._id}>
                  <td>{event.title}</td>
                  <td>{new Date(event.date).toLocaleDateString()}</td>
                  <td>{event.venue || "N/A"}</td>
                  <td>
                    <span className={`event-status status-${getEventStatus(event)}`}>
                      {getEventStatusLabel(event)}
                    </span>
                  </td>
                  <td>{event.createdBy?.username || "N/A"}</td>
                  <td>
                    {event.poster ? (
                      <img
                        src={`http://localhost:3001/uploads/${event.poster}`}
                        alt={event.title}
                        className="poster-img"
                      />
                    ) : (
                      "No poster"
                    )}
                  </td>
                  <td>
                    <div className="event-actions">
                      <button
                        className="details-btn"
                        onClick={() => setSelectedEvent(event)}
                      >
                        Details
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(event._id)}
                        disabled={deletingId === event._id}
                      >
                        {deletingId === event._id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedEvent ? (
        <div
          className="event-details-overlay"
          role="presentation"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="event-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="event-details-close"
              onClick={() => setSelectedEvent(null)}
              aria-label="Close event details"
            >
              x
            </button>

            <div className="event-details-header">
              <div>
                <p className="event-details-eyebrow">Event Details</p>
                <h3 id="event-details-title">{selectedEvent.title}</h3>
              </div>
              <span className={`event-status status-${getEventStatus(selectedEvent)}`}>
                {getEventStatusLabel(selectedEvent)}
              </span>
            </div>

            <div className="event-details-grid">
              {selectedEvent.poster ? (
                <div className="event-details-section full">
                  <h4>Poster Preview</h4>
                  <img
                    src={`${API_BASE}/uploads/${selectedEvent.poster}`}
                    alt={selectedEvent.title}
                    className="event-details-poster"
                  />
                </div>
              ) : null}

              <div className="event-details-section full">
                <h4>Description</h4>
                <p>{selectedEvent.description || "No description available."}</p>
              </div>

              <div className="event-details-section">
                <h4>Schedule</h4>
                <p><strong>Start:</strong> {formatDateTime(selectedEvent.date)}</p>
                <p><strong>End:</strong> {formatDateTime(selectedEvent.endDate)}</p>
                <p>
                  <strong>Registration Deadline:</strong>{" "}
                  {formatDateTime(selectedEvent.registrationDeadline)}
                </p>
                <p><strong>Ended At:</strong> {formatDateTime(selectedEvent.endedAt)}</p>
              </div>

              <div className="event-details-section">
                <h4>Venue & Capacity</h4>
                <p><strong>Venue:</strong> {selectedEvent.venue || "N/A"}</p>
                <p><strong>Capacity:</strong> {selectedEvent.capacity ?? "N/A"}</p>
                <p>
                  <strong>Registered Attendees:</strong>{" "}
                  {selectedEvent.attendees?.length || 0}
                </p>
              </div>

              <div className="event-details-section">
                <h4>Coordinator</h4>
                <p><strong>Username:</strong> {selectedEvent.createdBy?.username || "N/A"}</p>
                <p><strong>Email:</strong> {selectedEvent.createdBy?.email || "N/A"}</p>
                <p><strong>Role:</strong> {selectedEvent.createdBy?.role || "N/A"}</p>
              </div>

              <div className="event-details-section">
                <h4>System Fields</h4>
                <p><strong>Created At:</strong> {formatDateTime(selectedEvent.createdAt)}</p>
                <p><strong>Event ID:</strong> {selectedEvent._id}</p>
                <p><strong>Poster:</strong> {selectedEvent.poster || "No poster uploaded"}</p>
              </div>

              {selectedEvent.eventMode === "ranking" ? (
                <div className="event-details-section full">
                  <h4>Published Rankings</h4>
                  {selectedEvent.leaderboard?.length ? (
                    <div className="event-attendee-meta">
                      {selectedEvent.leaderboard.map((entry) => (
                        <span key={entry._id}>
                          <strong>Rank {entry.rank}:</strong> {entry.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p>No published ranking results yet.</p>
                  )}
                </div>
              ) : null}

              <div className="event-details-section full">
                <h4>Participant Details</h4>
                {selectedEventAttendees.length > 0 ? (
                  <div className="event-attendee-list">
                    {selectedEventAttendees.map((attendee) => (
                      <div key={attendee._id} className="event-attendee-card">
                        <div className="event-attendee-top">
                          <div className="event-attendee-summary">
                            <img
                              src={getUserImageUrl(attendee.participant)}
                              alt={attendee.participant?.username || "Participant"}
                              className="event-attendee-avatar"
                              onError={(event) => {
                                event.currentTarget.src = `${API_BASE}/uploads/default.png`;
                              }}
                            />
                            <div>
                              <strong>
                                {attendee.participant?.fullName ||
                                  attendee.participant?.username ||
                                  "Unknown Participant"}
                              </strong>
                              <span>{attendee.participant?.email || "No email available"}</span>
                            </div>
                          </div>
                          <span className={`event-status status-${attendee.status || "registered"}`}>
                            {attendee.status || "registered"}
                          </span>
                        </div>
                        <div className="event-attendee-meta">
                          <span>
                            <strong>Username:</strong> {attendee.participant?.username || "N/A"}
                          </span>
                          <span>
                            <strong>Department:</strong> {attendee.participant?.department || "N/A"}
                          </span>
                          <span>
                            <strong>Year:</strong> {attendee.participant?.year ?? "N/A"}
                          </span>
                          <span>
                            <strong>Checked In:</strong> {formatDateTime(attendee.checkedInAt)}
                          </span>
                          <span>
                            <strong>Check-In Method:</strong> {attendee.checkInMethod || "N/A"}
                          </span>
                          <span>
                            <strong>Certificate:</strong>{" "}
                            {attendee.certificateNumber || "Not issued"}
                          </span>
                          <span className="event-attendee-id">
                            <strong>Participant ID:</strong> {attendee.participantId || "N/A"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No participants registered for this event yet.</p>
                )}
              </div>

            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AdminEvent;
