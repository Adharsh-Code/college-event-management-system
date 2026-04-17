import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import "./css/ParticipantEventPasses.css";

const API_BASE = "http://localhost:3001";

function ParticipantEventPasses() {
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedEventId, setCopiedEventId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("latest");

  useEffect(() => {
    const fetchPasses = async () => {
      try {
        setLoading(true);
        setError("");
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE}/participant/event-passes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPasses(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        const serverError = err?.response?.data;
        setError(
          [serverError?.error, serverError?.details].filter(Boolean).join(": ") ||
            "Failed to load event passes"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPasses();
  }, []);

  const filteredPasses = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let data = [...passes];

    if (normalizedSearch) {
      data = data.filter((pass) =>
        [pass.title, pass.venue, pass.description, pass.coordinatorName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      );
    }

    if (sortBy === "oldest") {
      data.sort((left, right) => new Date(left.date || 0) - new Date(right.date || 0));
    } else if (sortBy === "title_asc") {
      data.sort((left, right) => (left.title || "").localeCompare(right.title || ""));
    } else if (sortBy === "title_desc") {
      data.sort((left, right) => (right.title || "").localeCompare(left.title || ""));
    } else {
      data.sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0));
    }

    return data;
  }, [passes, searchTerm, sortBy]);

  const handleCopy = async (eventId, token) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedEventId(eventId);
      window.setTimeout(() => setCopiedEventId(""), 1800);
    } catch {
      setCopiedEventId("");
    }
  };

  return (
    <div className="participant-passes-page">
      <section className="participant-passes-hero">
        <div>
          <p className="participant-passes-eyebrow">Event Passes</p>
          <h1>Your attendance tokens for registered events</h1>
          <p className="participant-passes-subtitle">
            Present this token at the venue for check-in.
          </p>
        </div>
        <div className="participant-passes-count">
          <span>{passes.length}</span>
          <small>Registered Events</small>
        </div>
      </section>

      <div className="participant-passes-toolbar">
        <input
          type="text"
          className="participant-passes-search"
          placeholder="Search your passes..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <select
          className="participant-passes-sort"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="latest">Event Date: Latest First</option>
          <option value="oldest">Event Date: Earliest First</option>
          <option value="title_asc">Title: A-Z</option>
          <option value="title_desc">Title: Z-A</option>
        </select>
      </div>

      {loading ? (
        <div className="participant-passes-state">Loading event passes...</div>
      ) : error ? (
        <div className="participant-passes-state participant-passes-error">{error}</div>
      ) : filteredPasses.length === 0 ? (
        <div className="participant-passes-state">
          {passes.length === 0
            ? "You do not have any registered event passes yet."
            : "No event passes match your search."}
        </div>
      ) : (
        <div className="participant-passes-grid">
          {filteredPasses.map((pass) => (
            <article className="participant-pass-card" key={pass.eventId}>
              <div className="participant-pass-top">
                <div>
                  <h2>{pass.title}</h2>
                  <p>{pass.description || "No event description available."}</p>
                </div>
                <span className={`participant-pass-badge ${pass.attendance.status}`}>
                  {pass.attendance.status}
                </span>
              </div>

              <div className="participant-pass-meta">
                <span>{new Date(pass.date).toLocaleString()}</span>
                <span>{pass.venue}</span>
                <span>Coordinator: {pass.coordinatorName}</span>
              </div>

              <div className="participant-pass-token-box">
                <div className="participant-pass-token-label">Check-in Token</div>
                <code>{pass.attendance.checkInToken}</code>
              </div>

              <div className="participant-pass-qr-box">
                <div className="participant-pass-token-label">QR Check-In Pass</div>
                <div className="participant-pass-qr-image">
                  <QRCodeSVG
                    value={pass.attendance.checkInToken}
                    size={220}
                    bgColor="#ffffff"
                    fgColor="#132743"
                    includeMargin
                  />
                </div>
                <p className="participant-pass-qr-help">
                  Show this QR to the coordinator scanner, or use the token if scanning is not
                  available.
                </p>
              </div>

              <div className="participant-pass-status">
                {pass.attendance.checkedInAt ? (
                  <p>
                    Checked in on {new Date(pass.attendance.checkedInAt).toLocaleString()} via{" "}
                    {pass.attendance.checkInMethod || "manual"}.
                  </p>
                ) : pass.attendance.isCheckInOpen ? (
                  <p>Check-in is open for this event pass.</p>
                ) : pass.endedAt ? (
                  <p>This event has already ended.</p>
                ) : (
                  <p>Keep this pass ready for event-day check-in.</p>
                )}
              </div>

              <div className="participant-pass-actions">
                <button
                  type="button"
                  onClick={() => handleCopy(pass.eventId, pass.attendance.checkInToken)}
                >
                  {copiedEventId === pass.eventId ? "Copied" : "Copy Token"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default ParticipantEventPasses;
