import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./css/ParticipantFeedback.css";

const API_BASE = "http://localhost:3001";

const createEmptyDraft = () => ({
  rating: 5,
  comment: "",
  recommend: true,
});

function ParticipantFeedback() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeEventId, setActiveEventId] = useState("");
  const [draft, setDraft] = useState(createEmptyDraft());
  const [submittingEventId, setSubmittingEventId] = useState("");

  useEffect(() => {
    fetchEligibleEvents();
  }, []);

  const fetchEligibleEvents = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/participant/feedback-eligible`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEvents(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load feedback events");
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return events;

    return events.filter((event) =>
      [event.title, event.venue, event.description, event.coordinatorName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [events, searchTerm]);

  const openForm = (event) => {
    setActionMessage("");
    setActiveEventId(event.eventId);
    setDraft({
      rating: event.feedback?.rating || 5,
      comment: event.feedback?.comment || "",
      recommend:
        typeof event.feedback?.recommend === "boolean" ? event.feedback.recommend : true,
    });
  };

  const closeForm = () => {
    setActiveEventId("");
    setDraft(createEmptyDraft());
  };

  const handleSubmit = async (event) => {
    try {
      setSubmittingEventId(event.eventId);
      setActionMessage("");
      const token = localStorage.getItem("token");
      const payload = {
        rating: Number(draft.rating),
        comment: draft.comment,
        recommend: draft.recommend,
      };

      const request = event.hasSubmittedFeedback
        ? axios.patch(`${API_BASE}/events/${event.eventId}/feedback`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          })
        : axios.post(`${API_BASE}/events/${event.eventId}/feedback`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          });

      const response = await request;
      const feedback = response.data?.feedback;

      setEvents((currentEvents) =>
        currentEvents.map((item) =>
          item.eventId === event.eventId
            ? {
                ...item,
                hasSubmittedFeedback: true,
                feedback,
              }
            : item
        )
      );
      setActionMessage(response.data?.message || "Feedback saved successfully");
      closeForm();
    } catch (err) {
      setActionMessage(err?.response?.data?.error || "Failed to save feedback");
    } finally {
      setSubmittingEventId("");
    }
  };

  const submittedCount = events.filter((event) => event.hasSubmittedFeedback).length;

  return (
    <div className="participant-feedback-page">
      <section className="participant-feedback-hero">
        <div>
          <p className="participant-feedback-eyebrow">Post Event Feedback</p>
          <h1>Share what worked after each completed event</h1>
          <p className="participant-feedback-subtitle">
            Feedback is available for events you attended and were marked present in.
          </p>
        </div>
        <div className="participant-feedback-stats">
          <div className="participant-feedback-stat">
            <span>{events.length}</span>
            <small>Eligible Events</small>
          </div>
          <div className="participant-feedback-stat">
            <span>{submittedCount}</span>
            <small>Submitted</small>
          </div>
        </div>
      </section>

      <div className="participant-feedback-toolbar">
        <input
          type="text"
          className="participant-feedback-search"
          placeholder="Search completed events..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {actionMessage ? (
        <div className="participant-feedback-banner">{actionMessage}</div>
      ) : null}

      {loading ? (
        <div className="participant-feedback-state">Loading feedback events...</div>
      ) : error ? (
        <div className="participant-feedback-state participant-feedback-error">{error}</div>
      ) : filteredEvents.length === 0 ? (
        <div className="participant-feedback-state">
          {events.length === 0
            ? "No completed attended events are available for feedback yet."
            : "No events match your search."}
        </div>
      ) : (
        <div className="participant-feedback-grid">
          {filteredEvents.map((event) => {
            const isOpen = activeEventId === event.eventId;
            const isSubmitting = submittingEventId === event.eventId;

            return (
              <article className="participant-feedback-card" key={event.eventId}>
                <div className="participant-feedback-card-header">
                  <div>
                    <h2>{event.title}</h2>
                    <p>{event.description || "No description available."}</p>
                  </div>
                  <span className="participant-feedback-status">
                    {event.hasSubmittedFeedback ? "Submitted" : "Pending"}
                  </span>
                </div>

                <div className="participant-feedback-meta">
                  <span>{new Date(event.date).toLocaleString()}</span>
                  <span>{event.venue}</span>
                  <span>Coordinator: {event.coordinatorName}</span>
                </div>

                {event.hasSubmittedFeedback ? (
                  <div className="participant-feedback-existing">
                    <strong>{event.feedback?.rating}/5</strong>
                    <p>{event.feedback?.comment || "No comment added."}</p>
                    <small>
                      Recommend:{" "}
                      {typeof event.feedback?.recommend === "boolean"
                        ? event.feedback.recommend
                          ? "Yes"
                          : "No"
                        : "Not specified"}
                    </small>
                  </div>
                ) : null}

                <div className="participant-feedback-actions">
                  <button type="button" onClick={() => openForm(event)}>
                    {event.hasSubmittedFeedback ? "Edit Feedback" : "Give Feedback"}
                  </button>
                </div>

                {isOpen ? (
                  <div className="participant-feedback-form">
                    <label>
                      Rating
                      <select
                        value={draft.rating}
                        onChange={(item) =>
                          setDraft((current) => ({
                            ...current,
                            rating: Number(item.target.value),
                          }))
                        }
                      >
                        <option value={5}>5 - Excellent</option>
                        <option value={4}>4 - Good</option>
                        <option value={3}>3 - Average</option>
                        <option value={2}>2 - Poor</option>
                        <option value={1}>1 - Very Poor</option>
                      </select>
                    </label>

                    <label>
                      Would you recommend this event?
                      <div className="participant-feedback-recommend">
                        <button
                          type="button"
                          className={draft.recommend ? "active" : ""}
                          onClick={() =>
                            setDraft((current) => ({ ...current, recommend: true }))
                          }
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className={!draft.recommend ? "active" : ""}
                          onClick={() =>
                            setDraft((current) => ({ ...current, recommend: false }))
                          }
                        >
                          No
                        </button>
                      </div>
                    </label>

                    <label>
                      Comments
                      <textarea
                        rows={5}
                        maxLength={1000}
                        value={draft.comment}
                        onChange={(item) =>
                          setDraft((current) => ({
                            ...current,
                            comment: item.target.value,
                          }))
                        }
                        placeholder="What should the coordinator keep, improve, or change next time?"
                      />
                    </label>

                    <div className="participant-feedback-form-actions">
                      <button
                        type="button"
                        onClick={() => handleSubmit(event)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting
                          ? "Saving..."
                          : event.hasSubmittedFeedback
                            ? "Update Feedback"
                            : "Submit Feedback"}
                      </button>
                      <button type="button" className="secondary" onClick={closeForm}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ParticipantFeedback;
