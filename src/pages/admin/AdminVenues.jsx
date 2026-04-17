import { useCallback, useEffect, useMemo, useState } from "react";
import "./css/AdminVenues.css";

const API_BASE = "http://localhost:3001";

function AdminVenues() {
  const initialForm = {
    name: "",
    location: "",
    description: "",
    capacity: "",
  };

  const [venues, setVenues] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [editingVenueId, setEditingVenueId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [historyVenueId, setHistoryVenueId] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState({ venue: null, events: [] });

  const token = localStorage.getItem("token");

  const fetchVenues = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/venues`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load venues");
      }

      setVenues(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadVenueHistory = useCallback(async (venueId) => {
    const response = await fetch(`${API_BASE}/venues/${venueId}/history`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load venue history");
    }

    setHistoryData({
      venue: data.venue || null,
      events: Array.isArray(data.events) ? data.events : [],
    });
  }, [token]);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  const filteredVenues = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return venues.filter((venue) =>
      [venue.name, venue.location, venue.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [venues, searchTerm]);

  const resetForm = () => {
    setFormData(initialForm);
    setEditingVenueId("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (venue) => {
    setEditingVenueId(venue._id);
    setFormData({
      name: venue.name || "",
      location: venue.location || "",
      description: venue.description || "",
      capacity: venue.capacity ? String(venue.capacity) : "",
    });
    setMessage({ type: "", text: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleHistory = async (venueId) => {
    try {
      setHistoryLoading(true);
      setHistoryVenueId(venueId);
      await loadVenueHistory(venueId);
    } catch (err) {
      setHistoryVenueId("");
      setHistoryData({ venue: null, events: [] });
      setMessage({ type: "error", text: err.message });
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setHistoryVenueId("");
    setHistoryData({ venue: null, events: [] });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage({ type: "", text: "" });

    try {
      setSaving(true);
      const response = await fetch(
        editingVenueId ? `${API_BASE}/venues/${editingVenueId}` : `${API_BASE}/venues`,
        {
          method: editingVenueId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...formData,
            capacity: formData.capacity.trim(),
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save venue");
      }

      const savedVenueName = data?.name || formData.name.trim();
      resetForm();
      setMessage({
        type: "success",
        text: editingVenueId
          ? `Venue "${savedVenueName}" updated successfully.`
          : `Venue "${savedVenueName}" added successfully.`,
      });
      await fetchVenues();

      if (historyVenueId && historyVenueId === editingVenueId) {
        await loadVenueHistory(historyVenueId);
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
  };

  return (
    <div className="admin-venues-page">
      <div className="admin-venues-hero">
        <div>
          <h2 className="admin-venues-title">Manage Venues</h2>
          <p className="admin-venues-subtitle">
            Add and update venues
          </p>
        </div>
        <div className="admin-venues-count">
          <span>{venues.length}</span>
          <small>Total Venues</small>
        </div>
      </div>

      {message.text ? (
        <div className={`admin-venues-message ${message.type}`}>{message.text}</div>
      ) : null}

      <div className="admin-venues-layout">
        <form className="admin-venues-form" onSubmit={handleSubmit}>
          <div className="admin-venues-form-head">
            <div>
              <h3>{editingVenueId ? "Edit Venue" : "Add Venue"}</h3>
              <p>
                {editingVenueId
                  ? "Update venue details and keep linked event records in sync."
                  : "Create a venue coordinators can select while scheduling events."}
              </p>
            </div>
            {editingVenueId ? (
              <button
                type="button"
                className="admin-venues-secondary-btn"
                onClick={resetForm}
              >
                Cancel
              </button>
            ) : null}
          </div>

          <label>
            Venue Name *
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Main Auditorium"
              required
            />
          </label>

          <label>
            Location
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Block A, 2nd Floor"
            />
          </label>

          <label>
            Capacity
            <input
              type="number"
              name="capacity"
              min="1"
              value={formData.capacity}
              onChange={handleChange}
              placeholder="300"
            />
          </label>

          <label>
            Description
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Projector, stage, AC, and fixed seating."
            />
          </label>

          <button type="submit" className="admin-venues-btn" disabled={saving}>
            {saving
              ? editingVenueId
                ? "Updating..."
                : "Saving..."
              : editingVenueId
                ? "Update Venue"
                : "Add Venue"}
          </button>
        </form>

        <div className="admin-venues-panel">
          <div className="admin-venues-toolbar">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search venues..."
            />
          </div>

          {loading ? (
            <div className="admin-venues-state">Loading venues...</div>
          ) : filteredVenues.length === 0 ? (
            <div className="admin-venues-state">No venues found.</div>
          ) : (
            <div className="admin-venues-list">
              {filteredVenues.map((venue) => {
                return (
                  <article className="admin-venues-card" key={venue._id}>
                    <div className="admin-venues-card-head">
                      <h4>{venue.name}</h4>
                      <span>{venue.capacity ? `${venue.capacity} seats` : "Capacity N/A"}</span>
                    </div>
                    <p>{venue.location || "Location not added yet"}</p>
                    <small>{venue.description || "No extra details for this venue yet."}</small>

                    <div className="admin-venues-card-actions">
                      <button
                        type="button"
                        className="admin-venues-card-btn"
                        onClick={() => handleEdit(venue)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-venues-card-btn secondary"
                        onClick={() => handleHistory(venue._id)}
                        disabled={historyLoading && historyVenueId === venue._id}
                      >
                        {historyLoading && historyVenueId === venue._id
                          ? "Loading..."
                          : "View History"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {historyVenueId ? (
        <div className="admin-venues-modal-backdrop" onClick={closeHistoryModal}>
          <div
            className="admin-venues-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="venue-history-title"
          >
            <div className="admin-venues-modal-head">
              <div>
                <h3 id="venue-history-title">
                  {historyData.venue?.name || "Venue"} Event History
                </h3>
                <p>
                  {historyLoading
                    ? "Loading event history..."
                    : `${historyData.events.length} event${
                        historyData.events.length === 1 ? "" : "s"
                      } found for this venue.`}
                </p>
              </div>
              <button
                type="button"
                className="admin-venues-modal-close"
                onClick={closeHistoryModal}
              >
                Close
              </button>
            </div>

            {historyLoading ? (
              <div className="admin-venues-history-empty">Loading venue history...</div>
            ) : historyData.events.length === 0 ? (
              <div className="admin-venues-history-empty">
                No events have used this venue yet.
              </div>
            ) : (
              <div className="admin-venues-history-list">
                {historyData.events.map((historyEvent) => (
                  <div className="admin-venues-history-item" key={historyEvent._id}>
                    <div className="admin-venues-history-title-row">
                      <strong>{historyEvent.title}</strong>
                      <span>{historyEvent.endedAt ? "Completed" : "Scheduled"}</span>
                    </div>
                    <p>
                      {formatDateTime(historyEvent.date)} to{" "}
                      {formatDateTime(historyEvent.endDate)}
                    </p>
                    <small>
                      Coordinator: {historyEvent.coordinatorName} | {historyEvent.attendeeCount}/
                      {historyEvent.capacity || 0} attendees
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AdminVenues;
