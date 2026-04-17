import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "./css/ParticipantDashboard.css";

const API_BASE = "http://localhost:3001";

function ParticipantDashboard() {
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username") || "Participant";
  const email = localStorage.getItem("email") || "N/A";

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError("");

      try {
        const [profileRes, eventsRes] = await Promise.all([
          axios.get(`${API_BASE}/users/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE}/events`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setProfile(profileRes.data);
        setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
      } catch (err) {
        setError(
          err?.response?.data?.error || "Failed to load participant dashboard"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [token]);

  const stats = useMemo(() => {
    const now = new Date();

    const upcoming = events.filter((event) => !event.endedAt && new Date(event.date) > now);
    const openRegistration = events.filter(
      (event) =>
        !event.endedAt &&
        new Date(event.date) > now &&
        new Date(event.registrationDeadline) > now
    );
    const happeningSoon = upcoming
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 4);

    return {
      totalEvents: events.length,
      upcomingCount: upcoming.length,
      openRegistrationCount: openRegistration.length,
      happeningSoon,
    };
  }, [events]);

  if (loading) {
    return (
      <section className="participant-dashboard">
        <div className="participant-dashboard-loading">Loading dashboard...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="participant-dashboard">
        <div className="participant-dashboard-error">{error}</div>
      </section>
    );
  }

  return (
    <section className="participant-dashboard">
      <header className="participant-dashboard-header">
        <div>
          <h1>Welcome, {profile?.username || username}</h1>
          <p>{new Date().toLocaleDateString("en-US", { dateStyle: "full" })}</p>
        </div>
        <Link to="/participant/ViewEvents" className="participant-dashboard-cta">
          Browse Events
        </Link>
      </header>

      <div className="participant-dashboard-grid">
        <article className="participant-panel participant-profile-panel">
          <h2>Profile</h2>
          <p>
            <span>Name:</span> {profile?.fullName || profile?.username || username}
          </p>
          <p>
            <span>Email:</span> {profile?.email || email}
          </p>
          <p>
            <span>Department:</span> {profile?.department || "Not set"}
          </p>
          <p>
            <span>Year:</span> {profile?.year || "Not set"}
          </p>
          <Link to="/participant/Profile" className="participant-panel-link">
            Edit Profile
          </Link>
        </article>

        <article className="participant-panel participant-stats-panel">
          <h2>Event Snapshot</h2>
          <div className="participant-stats">
            <div>
              <strong>{stats.totalEvents}</strong>
              <span>Total Events</span>
            </div>
            <div>
              <strong>{stats.upcomingCount}</strong>
              <span>Upcoming</span>
            </div>
            <div>
              <strong>{stats.openRegistrationCount}</strong>
              <span>Registration Open</span>
            </div>
          </div>
        </article>
      </div>

      <article className="participant-panel participant-events-panel">
        <div className="participant-panel-head">
          <h2>Upcoming Events</h2>
          <Link to="/participant/ViewEvents" className="participant-panel-link">
            View All
          </Link>
        </div>

        {stats.happeningSoon.length === 0 ? (
          <p className="participant-empty">No upcoming events available.</p>
        ) : (
          <div className="participant-events-list">
            {stats.happeningSoon.map((event) => (
              <div key={event._id} className="participant-event-item">
                <h3>{event.title}</h3>
                <p>{event.venue}</p>
                <span>
                  {new Date(event.date).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

export default ParticipantDashboard;
