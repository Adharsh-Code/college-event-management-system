import { memo } from "react";
import { Link } from "react-router-dom";

const CoordinatorEventCard = memo(function CoordinatorEventCard({
  event,
  status,
  apiBase,
  currentUserId,
  endingEventId,
  onEndEvent,
}) {
  const isOwnedByCurrentUser =
    String(event.createdBy?._id || "") === String(currentUserId || "");

  return (
    <article className="coordinator-event-card">
      <div className="coordinator-event-poster">
        {event.poster ? (
          <img
            src={`${apiBase}/uploads/${event.poster}`}
            alt={event.title}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        ) : (
          <div className="coordinator-poster-placeholder">No Poster</div>
        )}
        <span className={`coordinator-status-badge ${status.className}`}>{status.text}</span>
      </div>

      <div className="coordinator-event-details">
        <h2>{event.title}</h2>
        <p className="coordinator-event-owner">
          Created by{" "}
          {event.createdBy?.fullName ||
            event.createdBy?.username ||
            event.createdBy?.email ||
            "Unknown coordinator"}
        </p>
        <p className="coordinator-event-description">
          {event.description || "No event description available."}
        </p>
        {event.eventMode === "ranking" ? (
          <p className="coordinator-event-owner">
            Ranking event: {event.rankingConfig?.metricLabel || "Result"} ·{" "}
            {event.rankingConfig?.resultsPublished ? "results published" : "results in draft"}
          </p>
        ) : null}

        <div className="coordinator-event-meta">
          <div className="coordinator-meta-item">
            <span className="coordinator-meta-label">Date</span>
            <span className="coordinator-meta-value">
              {new Date(event.date).toLocaleString()}
            </span>
          </div>

          <div className="coordinator-meta-item">
            <span className="coordinator-meta-label">Ends</span>
            <span className="coordinator-meta-value">
              {event.endDate ? new Date(event.endDate).toLocaleString() : "N/A"}
            </span>
          </div>

          <div className="coordinator-meta-item">
            <span className="coordinator-meta-label">Venue</span>
            <span className="coordinator-meta-value">{event.venue || "N/A"}</span>
          </div>

          <div className="coordinator-meta-item">
            <span className="coordinator-meta-label">Capacity</span>
            <span className="coordinator-meta-value">
              {(event.attendees || []).length}/{event.capacity || 0} seats filled
            </span>
          </div>

          <div className="coordinator-meta-item">
            <span className="coordinator-meta-label">Registration Deadline</span>
            <span className="coordinator-meta-value">
              {event.registrationDeadline
                ? new Date(event.registrationDeadline).toLocaleString()
                : "N/A"}
            </span>
          </div>
        </div>

        <div className="coordinator-participant-action">
          {isOwnedByCurrentUser ? (
            <>
              <Link
                className="coordinator-view-participants-btn"
                to={`/coordinator/events/${event._id}/participants`}
              >
                View Participants ({(event.attendees || []).length})
              </Link>
              {event.endedAt ? (
                <span className="coordinator-view-participants-btn is-disabled">
                  Open Check-In
                </span>
              ) : (
                <Link
                  className="coordinator-view-participants-btn"
                  to={`/coordinator/events/${event._id}/check-in`}
                >
                  Open Check-In
                </Link>
              )}
              {event.endedAt ? (
                <Link
                  className="coordinator-view-participants-btn"
                  to={`/coordinator/events/${event._id}/feedback`}
                >
                  View Feedback
                </Link>
              ) : null}
              <button
                type="button"
                className="coordinator-end-event-btn"
                onClick={() => onEndEvent(event)}
                disabled={Boolean(event.endedAt) || endingEventId === event._id}
              >
                {event.endedAt
                  ? "Event Ended"
                  : endingEventId === event._id
                    ? "Ending..."
                    : "End Event"}
              </button>
            </>
          ) : (
            <span className="coordinator-view-participants-btn is-disabled">
              View only: managed by another coordinator
            </span>
          )}
        </div>
      </div>
    </article>
  );
});

export default CoordinatorEventCard;
