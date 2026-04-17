import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./css/EventParticipants.css";

const API_BASE = "http://localhost:3001";
const STATUS_OPTIONS = ["registered", "present", "absent"];
const PAGE_SIZE_OPTIONS = [25, 50, 100];

function EventParticipants() {
  const { eventId } = useParams();
  const [attendees, setAttendees] = useState([]);
  const [eventTitle, setEventTitle] = useState("Event");
  const [endedAt, setEndedAt] = useState("");
  const [eventMode, setEventMode] = useState("standard");
  const [rankingConfig, setRankingConfig] = useState({
    metricLabel: "",
    metricUnit: "",
    rankingOrder: "higher",
    resultsPublished: false,
  });
  const [counts, setCounts] = useState({
    total: 0,
    registered: 0,
    present: 0,
    absent: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingStatusId, setSavingStatusId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("present");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [refreshKey, setRefreshKey] = useState(0);
  const [messageAllText, setMessageAllText] = useState("");
  const [messageAllLoading, setMessageAllLoading] = useState(false);
  const [messageAllFeedback, setMessageAllFeedback] = useState("");
  const [publishingResults, setPublishingResults] = useState(false);
  const [savingRankDraft, setSavingRankDraft] = useState(false);
  const [pendingRankChanges, setPendingRankChanges] = useState({});
  const [rankingFeedback, setRankingFeedback] = useState("");

  useEffect(() => {
    const fetchAttendees = async () => {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");
        const params = new URLSearchParams({
          page: String(pagination.page),
          limit: String(pageSize),
          status: statusFilter,
        });

        if (searchTerm.trim()) {
          params.set("search", searchTerm.trim());
        }

        const response = await fetch(
          `${API_BASE}/coordinator/events/${eventId}/attendees?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch participants");
        }

        setEventTitle(data.eventTitle || "Event");
        setEndedAt(data.endedAt || "");
        setEventMode(data.eventMode || "standard");
        setRankingConfig(
          data.rankingConfig || {
            metricLabel: "",
            metricUnit: "",
            rankingOrder: "higher",
            resultsPublished: false,
          }
        );
        setAttendees(Array.isArray(data.attendees) ? data.attendees : []);
        setCounts(
          data.counts || {
            total: 0,
            registered: 0,
            present: 0,
            absent: 0,
          }
        );
        setPagination(data.pagination || { page: 1, limit: pageSize, total: 0, totalPages: 1 });
        setSelectedIds([]);
        setPendingRankChanges({});
      } catch (err) {
        setError(err.message || "Failed to fetch participants");
      } finally {
        setLoading(false);
      }
    };

    fetchAttendees();
  }, [eventId, pagination.page, pageSize, searchTerm, statusFilter, refreshKey]);

  const allVisibleSelected =
    attendees.length > 0 && attendees.every((attendee) => selectedIds.includes(attendee._id));

  const selectedCount = selectedIds.length;

  const selectionSummary = useMemo(
    () => attendees.filter((attendee) => selectedIds.includes(attendee._id)),
    [attendees, selectedIds]
  );

  const availableRanks = useMemo(
    () => Array.from({ length: Math.max(0, counts.total || 0) }, (_, index) => index + 1),
    [counts.total]
  );

  const hasPendingRankChanges = useMemo(
    () => Object.keys(pendingRankChanges).length > 0,
    [pendingRankChanges]
  );

  const updateAttendeeStatus = async (attendeeId, payload) => {
    try {
      setSavingStatusId(attendeeId);
      setError("");
      setRankingFeedback("");

      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/coordinator/events/${eventId}/attendees/${attendeeId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update participant status");
      }

      setAttendees((currentAttendees) =>
        currentAttendees.map((attendee) =>
          attendee._id === attendeeId
            ? {
                ...attendee,
                ...payload,
                status: data.attendee?.status || payload.status,
                checkedInAt: data.attendee?.checkedInAt || null,
                checkInMethod: data.attendee?.checkInMethod || null,
                rank:
                  data.attendee?.rank === null || data.attendee?.rank === undefined
                    ? null
                    : data.attendee.rank,
                resultNote: data.attendee?.resultNote || "",
                resultEnteredAt: data.attendee?.resultEnteredAt || null,
                isDisqualified: Boolean(data.attendee?.isDisqualified),
              }
            : attendee
        )
      );
      if (eventMode === "ranking" && payload.status !== "present") {
        setPendingRankChanges((current) => {
          const next = { ...current };
          const changedAttendee = attendees.find((entry) => entry._id === attendeeId);
          if (changedAttendee?.participantId) {
            delete next[changedAttendee.participantId];
          }
          return next;
        });
      }
      setRefreshKey((currentKey) => currentKey + 1);
    } catch (err) {
      setError(err.message || "Failed to update participant status");
      setRefreshKey((currentKey) => currentKey + 1);
    } finally {
      setSavingStatusId("");
    }
  };

  const handleRankAssignment = async (participantId, rank) => {
    setPendingRankChanges((current) => {
      const next = { ...current };
      const normalizedRank = rank === "" ? "" : String(rank);
      const currentAttendee = attendees.find((entry) => entry.participantId === participantId);
      const getDisplayedRank = (attendee) => {
        const pendingValue = current[String(attendee.participantId)];
        if (pendingValue !== undefined) {
          return pendingValue;
        }
        return attendee?.rank === null || attendee?.rank === undefined ? "" : String(attendee.rank);
      };

      attendees.forEach((attendee) => {
        if (attendee.participantId === participantId) {
          return;
        }

        if (normalizedRank && getDisplayedRank(attendee) === normalizedRank) {
          next[attendee.participantId] = "";
        }
      });

      const savedRank = currentAttendee?.rank === null || currentAttendee?.rank === undefined
        ? ""
        : String(currentAttendee.rank);

      if (normalizedRank === savedRank) {
        delete next[participantId];
      } else {
        next[participantId] = normalizedRank;
      }

      return next;
    });
  };

  const handleSaveRankDraft = async () => {
    try {
      if (!hasPendingRankChanges) {
        return;
      }

      setSavingRankDraft(true);
      setError("");
      setRankingFeedback("");

      const token = localStorage.getItem("token");
      const changes = Object.entries(pendingRankChanges);

      for (const [participantId, rank] of changes) {
        const response = await fetch(`${API_BASE}/coordinator/events/${eventId}/ranking`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            participantId,
            rank,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to save rank");
        }
      }

      setPendingRankChanges({});
      setRankingFeedback("Draft saved. Review the ranking and publish when you're ready.");
      setRefreshKey((currentKey) => currentKey + 1);
    } catch (err) {
      setError(err.message || "Failed to save draft");
    } finally {
      setSavingRankDraft(false);
    }
  };

  const handleRankingPublishToggle = async (nextPublished) => {
    if (!nextPublished) {
      return;
    }

    const confirmed = window.confirm(
      "Publish these rankings permanently? After publishing, the results will be locked and cannot be edited."
    );
    if (!confirmed) {
      return;
    }

    try {
      setPublishingResults(true);
      setError("");
      setRankingFeedback("");

      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/coordinator/events/${eventId}/ranking/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update ranking settings");
      }

      setRankingConfig((current) => ({
        ...current,
        resultsPublished: nextPublished,
      }));
      setPendingRankChanges({});
      setRankingFeedback("Results published permanently. Rankings are now locked.");
      setRefreshKey((currentKey) => currentKey + 1);
    } catch (err) {
      setError(err.message || "Failed to update ranking settings");
    } finally {
      setPublishingResults(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.length === 0) return;

    try {
      setBulkLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/coordinator/events/${eventId}/attendees/bulk`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          attendeeIds: selectedIds,
          status: bulkStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to bulk update attendees");
      }

      setSelectedIds([]);
      setRefreshKey((currentKey) => currentKey + 1);
    } catch (err) {
      setError(err.message || "Failed to bulk update attendees");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleMessageAll = async () => {
    const content = messageAllText.trim();
    if (!content) return;

    try {
      setMessageAllLoading(true);
      setMessageAllFeedback("");
      setError("");

      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/coordinator/events/${eventId}/message-all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to message all participants");
      }

      setMessageAllText("");
      setMessageAllFeedback(data.message || "Message sent successfully");
    } catch (err) {
      setMessageAllFeedback(err.message || "Failed to message all participants");
    } finally {
      setMessageAllLoading(false);
    }
  };

  const getStatusLabel = (status) => {
    if (!status) return "Registered";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((currentIds) =>
        currentIds.filter((id) => !attendees.some((attendee) => attendee._id === id))
      );
      return;
    }

    setSelectedIds((currentIds) => {
      const next = new Set(currentIds);
      attendees.forEach((attendee) => next.add(attendee._id));
      return Array.from(next);
    });
  };

  const toggleSelectOne = (attendeeId) => {
    setSelectedIds((currentIds) =>
      currentIds.includes(attendeeId)
        ? currentIds.filter((id) => id !== attendeeId)
        : [...currentIds, attendeeId]
    );
  };

  if (loading) {
    return <div className="event-participants-state">Loading participants...</div>;
  }

  if (error && attendees.length === 0) {
    return (
      <div className="event-participants-state">
        <p>{error}</p>
        <Link to="/coordinator" className="event-participants-back">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <section className="event-participants-page">
      <div className="event-participants-header">
        <div>
          <h1>Attendance Management</h1>
          <p>{eventTitle}</p>
          {endedAt ? <p>Event ended on {new Date(endedAt).toLocaleString()}</p> : null}
        </div>
        <div className="event-participants-header-actions">
          {endedAt ? (
            <span
              className="event-participants-back event-participants-back-disabled"
              title="Check-in can't be opened after the event has ended."
            >
              Open Check-In
            </span>
          ) : (
            <Link to={`/coordinator/events/${eventId}/check-in`} className="event-participants-back">
              Open Check-In
            </Link>
          )}
          <Link to="/coordinator" className="event-participants-back">
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="event-participants-summary-grid">
        <article className="event-participants-summary-card">
          <strong>{counts.total}</strong>
          <span>Total Registered</span>
        </article>
        <article className="event-participants-summary-card">
          <strong>{counts.present}</strong>
          <span>Present</span>
        </article>
        <article className="event-participants-summary-card">
          <strong>{counts.registered}</strong>
          <span>Pending Check-In</span>
        </article>
        <article className="event-participants-summary-card">
          <strong>{counts.absent}</strong>
          <span>Absent</span>
        </article>
      </div>

      {false && eventMode === "ranking" ? (
        <div className="event-participants-message-all">
          <div className="event-participants-message-head">
            <div>
              <h2>Ranking Results</h2>
              <p>
                Metric: {rankingConfig.metricLabel || "Result"}{" "}
                {rankingConfig.metricUnit ? `(${rankingConfig.metricUnit})` : ""} ·{" "}
                {rankingConfig.rankingOrder === "lower"
                  ? "Lower value ranks first"
                  : "Higher value ranks first"}
              </p>
            </div>
            <span>{rankingConfig.resultsPublished ? "Published" : "Draft"}</span>
          </div>

          <div className="event-participants-bulk-row">
            <span>
              {endedAt
                ? "Choose ranks for present participants, then publish the final leaderboard."
                : "Ranking becomes available after the event ends."}
            </span>
            <button
              type="button"
              onClick={() => handleRankingPublishToggle(!rankingConfig.resultsPublished)}
              disabled={publishingResults || !endedAt || rankingConfig.resultsPublished}
            >
              {publishingResults
                ? "Saving..."
                : rankingConfig.resultsPublished
                  ? "Results Published"
                  : "Publish Results"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="event-participants-message-all">
        <div className="event-participants-message-head">
          <div>
            <h2>Message All Participants</h2>
            <p>Send one message to every participant registered for this event.</p>
          </div>
          <span>{counts.total} recipients</span>
        </div>

        <div className="event-participants-message-compose">
          <textarea
            rows={4}
            maxLength={2000}
            value={messageAllText}
            onChange={(event) => setMessageAllText(event.target.value)}
            placeholder="Write an update, reminder, venue change, or announcement for all participants..."
          />
          <button
            type="button"
            onClick={handleMessageAll}
            disabled={!messageAllText.trim() || messageAllLoading}
          >
            {messageAllLoading ? "Sending..." : "Message All"}
          </button>
        </div>

        {messageAllFeedback ? (
          <div className="event-participants-message-feedback">{messageAllFeedback}</div>
        ) : null}
      </div>

      <div className="event-participants-controls">
        <div className="event-participants-filter-row">
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setPagination((current) => ({ ...current, page: 1 }));
                setSearchTerm(searchInput);
              }
            }}
            placeholder="Search by name, username, email, or department"
          />
          <button
            type="button"
            onClick={() => {
              setPagination((current) => ({ ...current, page: 1 }));
              setSearchTerm(searchInput);
            }}
          >
            Search
          </button>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPagination((current) => ({ ...current, page: 1 }));
            }}
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status)}
              </option>
            ))}
          </select>

          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPagination((current) => ({ ...current, page: 1 }));
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </div>

        <div className="event-participants-bulk-row">
          <span>{selectedCount} selected on this session</span>
          <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                Mark as {getStatusLabel(status)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkUpdate}
            disabled={selectedCount === 0 || bulkLoading || Boolean(endedAt)}
          >
            {bulkLoading ? "Updating..." : "Apply Bulk Update"}
          </button>
        </div>
      </div>

      {eventMode === "ranking" ? (
        <div className="event-participants-controls event-participants-ranking-inline">
          <div className="event-participants-bulk-row">
              <span>
                {endedAt
                  ? rankingConfig.resultsPublished
                    ? "Published rankings are permanently locked for this event."
                    : "Review rank changes, save the draft, then publish the final results."
                  : "Assign rank changes from the Rank column, save the draft, and publish after the event ends."}
              </span>
              <button
                type="button"
                onClick={handleSaveRankDraft}
                disabled={
                  savingRankDraft ||
                  publishingResults ||
                  rankingConfig.resultsPublished ||
                  !hasPendingRankChanges
                }
              >
                {savingRankDraft ? "Saving Draft..." : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() => handleRankingPublishToggle(true)}
                disabled={
                  publishingResults ||
                  savingRankDraft ||
                  !endedAt ||
                  rankingConfig.resultsPublished ||
                  hasPendingRankChanges
                }
              >
                {publishingResults
                  ? "Publishing..."
                : rankingConfig.resultsPublished
                  ? "Published Permanently"
                  : "Publish Results"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="event-participants-inline-error">{error}</div> : null}
      {rankingFeedback ? <div className="event-participants-inline-success">{rankingFeedback}</div> : null}

      {attendees.length === 0 ? (
        <div className="event-participants-state">No participants matched this view.</div>
      ) : (
        <div className="event-participants-table-wrap">
          <table
            className={`event-participants-table${
              eventMode === "ranking" ? " event-participants-table-ranking" : ""
            }`}
          >
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                  />
                </th>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Department</th>
                <th>Year</th>
                <th>Checked In</th>
                <th>Method</th>
                {eventMode === "ranking" ? <th>Rank</th> : null}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((attendee) => {
                const participant = attendee.user || {};
                return (
                  <tr key={attendee._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(attendee._id)}
                        onChange={() => toggleSelectOne(attendee._id)}
                      />
                    </td>
                    <td>{participant.fullName || participant.username || "N/A"}</td>
                    <td>{participant.username || "N/A"}</td>
                    <td>{participant.email || "N/A"}</td>
                    <td>{participant.department || "N/A"}</td>
                    <td>{participant.year || "N/A"}</td>
                    <td>{attendee.checkedInAt ? new Date(attendee.checkedInAt).toLocaleString() : "N/A"}</td>
                    <td>{attendee.checkInMethod || "N/A"}</td>
                     {eventMode === "ranking" ? (
                       <td>
                         <select
                           className="event-participants-status-select"
                           value={
                             pendingRankChanges[attendee.participantId] ??
                             (attendee.rank ?? "")
                           }
                           disabled={
                             attendee.status !== "present" ||
                             rankingConfig.resultsPublished ||
                             publishingResults ||
                             savingRankDraft
                           }
                           title={
                              attendee.status !== "present"
                                 ? "Only present participants can receive ranks."
                                : rankingConfig.resultsPublished
                                  ? "Published rankings are locked and can no longer be edited."
                                : savingRankDraft
                                  ? "Saving rank draft..."
                                  : hasPendingRankChanges
                                    ? "Save your draft changes to update ranking results."
                                 : rankingConfig.resultsPublished
                                   ? "Changing a rank will move the published results back to draft until you publish again."
                                    : "Assign a unique draft rank to this participant."
                           }
                           onChange={(event) =>
                             handleRankAssignment(attendee.participantId, event.target.value)
                           }
                        >
                          <option value="">No rank</option>
                          {availableRanks.map((rank) => (
                            <option key={rank} value={rank}>
                              Rank {rank}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                    <td>
                      <div
                        className={`event-participants-status-wrap ${endedAt ? "is-locked" : ""}`}
                        title={
                          endedAt
                            ? "Attendance can't be edited after the event has ended."
                            : ""
                        }
                      >
                        <select
                          className="event-participants-status-select"
                          value={attendee.status || "registered"}
                          onChange={(event) =>
                            updateAttendeeStatus(attendee._id, {
                              status: event.target.value,
                            })
                          }
                          disabled={Boolean(endedAt) || savingStatusId === attendee._id}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {getStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="event-participants-footer">
        <div className="event-participants-pagination">
          <button
            type="button"
            onClick={() =>
              setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))
            }
            disabled={pagination.page <= 1}
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setPagination((current) => ({
                ...current,
                page: Math.min(pagination.totalPages, current.page + 1),
              }))
            }
            disabled={pagination.page >= pagination.totalPages}
          >
            Next
          </button>
        </div>

        <div className="event-participants-footer-note">
          Showing {attendees.length} of {pagination.total} filtered attendees.
        </div>
      </div>

      {selectionSummary.length > 0 ? (
        <div className="event-participants-selection-summary">
          <strong>Selected:</strong>{" "}
          {selectionSummary
            .slice(0, 5)
            .map((attendee) => attendee.user?.fullName || attendee.user?.username || "Participant")
            .join(", ")}
          {selectionSummary.length > 5 ? ` +${selectionSummary.length - 5} more` : ""}
        </div>
      ) : null}
    </section>
  );
}

export default EventParticipants;
