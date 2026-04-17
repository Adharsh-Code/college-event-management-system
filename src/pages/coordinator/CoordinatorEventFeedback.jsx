import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import "./css/CoordinatorEventFeedback.css";

const API_BASE = "http://localhost:3001";

function CoordinatorEventFeedback() {
  const { eventId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setLoading(true);
        setError("");
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE}/coordinator/events/${eventId}/feedback`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(response.data);
      } catch (err) {
        setError(err?.response?.data?.error || "Failed to load event feedback");
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [eventId]);

  if (loading) {
    return <div className="coordinator-feedback-state">Loading event feedback...</div>;
  }

  if (error) {
    return <div className="coordinator-feedback-state coordinator-feedback-error">{error}</div>;
  }

  if (!data) {
    return <div className="coordinator-feedback-state">No feedback data found.</div>;
  }

  const { event, summary, feedback } = data;

  return (
    <div className="coordinator-feedback-page">
      <div className="coordinator-feedback-topbar">
        <div>
          <p className="coordinator-feedback-eyebrow">Completed Event Feedback</p>
          <h1>{event.title}</h1>
          <p className="coordinator-feedback-subtitle">
            {new Date(event.date).toLocaleString()} at {event.venue}
          </p>
        </div>
        <Link className="coordinator-feedback-back" to="/coordinator">
          Back to Dashboard
        </Link>
      </div>

      <section className="coordinator-feedback-summary">
        <article className="coordinator-feedback-stat-card">
          <span>{summary.averageRating.toFixed(1)}</span>
          <small>Average Rating</small>
        </article>
        <article className="coordinator-feedback-stat-card">
          <span>{summary.totalResponses}</span>
          <small>Total Responses</small>
        </article>
        <article className="coordinator-feedback-stat-card">
          <span>{summary.recommendationRate}%</span>
          <small>Would Recommend</small>
        </article>
      </section>

      <section className="coordinator-feedback-breakdown">
        {[5, 4, 3, 2, 1].map((rating) => (
          <div className="coordinator-feedback-breakdown-row" key={rating}>
            <span>{rating} Star</span>
            <div className="coordinator-feedback-breakdown-bar">
              <div
                style={{
                  width: `${
                    summary.totalResponses > 0
                      ? (summary.ratingBreakdown[rating] / summary.totalResponses) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <strong>{summary.ratingBreakdown[rating]}</strong>
          </div>
        ))}
      </section>

      {feedback.length === 0 ? (
        <div className="coordinator-feedback-state">
          No one has submitted feedback for this event yet.
        </div>
      ) : (
        <section className="coordinator-feedback-list">
          {feedback.map((entry) => (
            <article className="coordinator-feedback-card" key={entry._id}>
              <div className="coordinator-feedback-card-header">
                <div>
                  <h2>
                    {entry.participant?.fullName || entry.participant?.username || "Participant"}
                  </h2>
                  <p>{entry.participant?.email || "No email available"}</p>
                </div>
                <span>{entry.rating}/5</span>
              </div>

              <div className="coordinator-feedback-card-meta">
                <span>
                  Recommend:{" "}
                  {typeof entry.recommend === "boolean"
                    ? entry.recommend
                      ? "Yes"
                      : "No"
                    : "Not specified"}
                </span>
                <span>{new Date(entry.createdAt).toLocaleString()}</span>
              </div>

              <p className="coordinator-feedback-comment">
                {entry.comment || "No written comment added."}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export default CoordinatorEventFeedback;
