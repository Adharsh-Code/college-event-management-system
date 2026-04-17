import { useCallback, useEffect, useRef, useState } from "react";
import CoordinatorEventCard from "./CoordinatorEventCard";
import "./css/CoordinatorDashboard.css";

const API_BASE = "http://localhost:3001";
const PAGE_SIZE = 9;
const CATALOG_CACHE_TTL_MS = 15000;
const dashboardCatalogCache = new Map();
const dashboardCatalogRequests = new Map();

function CoordinatorDashboard() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    ongoing: 0,
    upcoming: 0,
    registrationOpen: 0,
    past: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [endingEventId, setEndingEventId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("eventLate");
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const username = localStorage.getItem("username") || "Coordinator";
  const eventsSectionRef = useRef(null);

  const getCurrentUserId = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload?.id || null;
    } catch {
      return null;
    }
  };

  const currentUserId = getCurrentUserId();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [showAllEvents, statusFilter, sortBy, debouncedSearchTerm]);

  const applyCatalogData = useCallback((data) => {
    setEvents(Array.isArray(data?.items) ? data.items : []);
    setStats(
      data?.stats || {
        total: 0,
        ongoing: 0,
        upcoming: 0,
        registrationOpen: 0,
        past: 0,
      }
    );
    setPagination(
      data?.pagination || {
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1,
      }
    );
    setHasLoaded(true);
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      setError("");
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        scope: showAllEvents ? "all" : "mine",
        status: statusFilter,
        sort: sortBy,
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      });

      if (debouncedSearchTerm) {
        params.set("search", debouncedSearchTerm);
      }

      const requestUrl = `${API_BASE}/coordinator/events/catalog?${params.toString()}`;
      const requestKey = `${token || "guest"}::${requestUrl}`;
      const cachedEntry = dashboardCatalogCache.get(requestKey);
      const now = Date.now();

      if (cachedEntry && now - cachedEntry.timestamp < CATALOG_CACHE_TTL_MS) {
        applyCatalogData(cachedEntry.data);
        setLoading(false);
        return;
      }

      setLoading(true);

      let requestPromise = dashboardCatalogRequests.get(requestKey);
      if (!requestPromise) {
        requestPromise = fetch(requestUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Failed to fetch events");
          }

          dashboardCatalogCache.set(requestKey, {
            timestamp: Date.now(),
            data,
          });

          return data;
        });

        dashboardCatalogRequests.set(requestKey, requestPromise);
      }

      const data = await requestPromise;
      applyCatalogData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        scope: showAllEvents ? "all" : "mine",
        status: statusFilter,
        sort: sortBy,
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      });
      if (debouncedSearchTerm) {
        params.set("search", debouncedSearchTerm);
      }
      dashboardCatalogRequests.delete(`${token || "guest"}::${API_BASE}/coordinator/events/catalog?${params.toString()}`);
      setLoading(false);
    }
  }, [applyCatalogData, currentPage, debouncedSearchTerm, showAllEvents, sortBy, statusFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const getStatus = (event) => {
    if (event.catalogStatus === "done") return { text: "Completed", className: "done" };
    if (event.catalogStatus === "live") return { text: "Ongoing", className: "live" };
    if (event.catalogStatus === "open") return { text: "Registration Open", className: "open" };
    if (event.catalogStatus === "upcoming") return { text: "Upcoming", className: "upcoming" };

    const now = new Date();
    const startDate = new Date(event.date);
    const endDate = new Date(event.endDate || event.date);
    const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : null;

    if (event.endedAt) return { text: "Completed", className: "done" };
    if (endDate <= now) return { text: "Completed", className: "done" };
    if (startDate <= now && endDate > now) return { text: "Ongoing", className: "live" };
    if (deadline && deadline > now && startDate > now) {
      return { text: "Registration Open", className: "open" };
    }
    return { text: "Upcoming", className: "upcoming" };
  };

  const handleEndEvent = async (event) => {
    if (!event?._id || event.endedAt) return;

    const confirmed = window.confirm(
      `End "${event.title}" now? Certificates will be issued to participants marked present.`
    );
    if (!confirmed) return;

    try {
      setEndingEventId(event._id);
      setActionMessage("");
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE}/coordinator/events/${event._id}/end`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to end event");
      }

      dashboardCatalogCache.clear();
      dashboardCatalogRequests.clear();
      await fetchEvents();
      setActionMessage(
        data.message || "Event ended successfully and certificates were issued."
      );
    } catch (err) {
      setActionMessage(err.message || "Failed to end event");
    } finally {
      setEndingEventId("");
    }
  };

  const handleToggleEventsView = () => {
    setShowAllEvents((current) => !current);
    eventsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="coordinator-dashboard">
      <section className="coordinator-brochure-hero">
        <div className="coordinator-brochure-intro">
          <p className="coordinator-eyebrow">Event Brochure</p>
          <h1 className="coordinator-dashboard-title">Curated by {username}</h1>
          {/* <p className="coordinator-subtitle">
            A visual catalog of your hosted events, timelines, and registration windows.
          </p> */}
        </div>
        <div className="coordinator-brochure-actions">
          <button
            type="button"
            className="coordinator-create-btn"
            onClick={handleToggleEventsView}
          >
            {showAllEvents ? "My Events" : "View All Events"}
          </button>
          {/* <p className="coordinator-brochure-note">Keep your lineup active and up to date.</p> */}
        </div>
      </section>

      <section className="coordinator-stats-grid">
        <article className="coordinator-stat-card">
          <span className="coordinator-stat-label">Total Events</span>
          <span className="coordinator-stat-value">{stats.total}</span>
        </article>
        <article className="coordinator-stat-card">
          <span className="coordinator-stat-label">Ongoing</span>
          <span className="coordinator-stat-value">{stats.ongoing}</span>
        </article>
        <article className="coordinator-stat-card">
          <span className="coordinator-stat-label">Upcoming</span>
          <span className="coordinator-stat-value">{stats.upcoming}</span>
        </article>
        <article className="coordinator-stat-card">
          <span className="coordinator-stat-label">Completed</span>
          <span className="coordinator-stat-value">{stats.past}</span>
        </article>
        <article className="coordinator-stat-card">
          <span className="coordinator-stat-label">Registration Open</span>
          <span className="coordinator-stat-value">{stats.registrationOpen}</span>
        </article>
      </section>

      {actionMessage ? <div className="coordinator-dashboard-feedback">{actionMessage}</div> : null}
      {error ? <div className="coordinator-dashboard-error">{error}</div> : null}

      <section ref={eventsSectionRef} className="coordinator-events-panel">
        <div className="coordinator-events-panel-head">
          <div>
            <p className="coordinator-events-panel-eyebrow">
              {showAllEvents ? "All Events" : "My Events"}
            </p>
            <h2>
              {showAllEvents
                ? "Manage every event in one place"
                : "Manage the events you created"}
            </h2>
            <p className="coordinator-events-panel-copy">
              {showAllEvents
                ? "Search by title, venue, or description and sort the full event list the way you need."
                : "Search and sort through the events you published without leaving the dashboard."}
            </p>
          </div>
          <div className="coordinator-events-panel-count">
            <span>{pagination.total}</span>
            <small>{pagination.total === 1 ? "matching result" : "matching results"}</small>
          </div>
        </div>

        {stats.total > 0 || pagination.total > 0 || debouncedSearchTerm ? (
          <section className="coordinator-dashboard-controls">
            <input
              type="text"
              className="coordinator-dashboard-search"
              placeholder="Search by title, venue, or description..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <select
              className="coordinator-dashboard-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All Status</option>
              <option value="live">Ongoing</option>
              <option value="open">Registration Open</option>
              <option value="upcoming">Upcoming</option>
              <option value="done">Completed</option>
            </select>
            <select
              className="coordinator-dashboard-select"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="eventLate">Event Date (Latest)</option>
              <option value="eventSoon">Event Date (Soonest)</option>
              <option value="newest">Newest Created</option>
              <option value="oldest">Oldest Created</option>
            </select>
          </section>
        ) : null}

        {!hasLoaded && loading ? (
          <section className="coordinator-events-grid" aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <article key={index} className="coordinator-event-card coordinator-event-card-skeleton">
                <div className="coordinator-event-skeleton-poster"></div>
                <div className="coordinator-event-details">
                  <div className="coordinator-skeleton-line coordinator-skeleton-line-title"></div>
                  <div className="coordinator-skeleton-line coordinator-skeleton-line-copy"></div>
                  <div className="coordinator-skeleton-line coordinator-skeleton-line-copy short"></div>
                </div>
              </article>
            ))}
          </section>
        ) : pagination.total === 0 ? (
          <div className="coordinator-empty-state">
            {debouncedSearchTerm || statusFilter !== "all"
              ? "No events match your current search or filters."
              : showAllEvents
                ? "No events are available right now."
                : "You have not created any events yet."}
          </div>
        ) : (
          <section
            className={`coordinator-events-grid${events.length === 1 ? " is-single-result" : ""}`}
          >
            {events.map((event) => {
              const status = getStatus(event);

              return (
                <CoordinatorEventCard
                  key={event._id}
                  event={event}
                  status={status}
                  apiBase={API_BASE}
                  currentUserId={currentUserId}
                  endingEventId={endingEventId}
                  onEndEvent={handleEndEvent}
                />
              );
            })}
          </section>
        )}

        {pagination.totalPages > 1 ? (
          <div className="coordinator-pagination">
            <button
              type="button"
              className="coordinator-pagination-btn"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={pagination.page <= 1}
            >
              Previous
            </button>
            <span className="coordinator-pagination-summary">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              className="coordinator-pagination-btn"
              onClick={() =>
                setCurrentPage((page) => Math.min(pagination.totalPages, page + 1))
              }
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default CoordinatorDashboard;
