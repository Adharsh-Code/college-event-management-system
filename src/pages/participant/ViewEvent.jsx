import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  ImageOff,
  Info,
  MapPin,
  Search,
  Users,
  X,
} from "lucide-react";
import "./css/ViewEvent.css";

const API_BASE = "http://localhost:3001";

function ViewEvent() {
  const [events, setEvents] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("dateDesc");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");
  const [registeringId, setRegisteringId] = useState("");
  const [venueDetailsEvent, setVenueDetailsEvent] = useState(null);
  const [leaderboardEvent, setLeaderboardEvent] = useState(null);

  const filterRef = useRef(null);
  const sortRef = useRef(null);

  useEffect(() => {
    fetchEvents();
    fetchProfile();
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterDropdownOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setIsSortDropdownOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setVenueDetailsEvent(null);
        setLeaderboardEvent(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const getEventTiming = (event) => {
    const startDate = new Date(event.date);
    const endDate = new Date(event.endDate || event.date);
    const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : null;

    return { startDate, endDate, deadline };
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/events`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setProfile(null);
        setProfileLoaded(true);
        return;
      }

      const res = await axios.get(`${API_BASE}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(res.data || null);
    } catch (err) {
      console.error(err);
      setProfile(null);
    } finally {
      setProfileLoaded(true);
    }
  };

  const getIncompleteProfileFields = (user) => {
    if (!user) {
      return ["full name", "phone number", "department"];
    }

    const missingFields = [];
    const fullName = (user.fullName || "").trim();
    const phone = (user.phone || "").trim();
    const department = (user.department || "").trim();
    const year = user.year === null || user.year === undefined ? "" : String(user.year).trim();

    if (!fullName) missingFields.push("full name");
    if (!phone) missingFields.push("phone number");
    if (!department) missingFields.push("department");
    if (department !== "Staff" && !year) missingFields.push("year");

    return missingFields;
  };

  const isProfileComplete = (user) => getIncompleteProfileFields(user).length === 0;

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

  const isRegistered = (event) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return false;
    return (event.attendees || []).some((attendee) => {
      const attendeeId =
        typeof attendee.user === "string" ? attendee.user : attendee.user?._id;
      return attendeeId === currentUserId;
    });
  };

  const isRegistrationAllowed = (event) => {
    const now = new Date();
    const { startDate, deadline } = getEventTiming(event);
    const seatsFilled = (event.attendees || []).length >= (event.capacity || 0);
    return (
      profileLoaded &&
      isProfileComplete(profile) &&
      !event.endedAt &&
      startDate > now &&
      deadline &&
      deadline > now &&
      !seatsFilled &&
      !isRegistered(event)
    );
  };

  const getRegisterButtonLabel = (event) => {
    if (isRegistered(event)) return "Registered";
    if (!profileLoaded) return "Checking Profile...";
    if (!isProfileComplete(profile)) return "Complete Profile First";
 
    const now = new Date();
    const { startDate, endDate, deadline } = getEventTiming(event);

    if (event.endedAt) return "Event Ended";
    if (endDate <= now) return "Event Ended";
    if (startDate <= now && endDate > now) return "Event In Progress";
    if (deadline && deadline <= now) return "Registration Closed";
    if ((event.attendees || []).length >= (event.capacity || 0)) return "Full";
    return "Register";
  };

  const handleRegister = async (event) => {
    const eventId = event?._id;
    if (!eventId) return;
    if (!profileLoaded || !isProfileComplete(profile)) {
      setActionMessage(
        profileCompletionMessage ||
          "Complete your profile before registering for events."
      );
      return;
    }

    const confirmMessage = `Do you want to register for "${event.title}"?`;
    const isConfirmed = window.confirm(confirmMessage);
    if (!isConfirmed) return;

    try {
      setRegisteringId(eventId);
      setActionMessage("");
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE}/events/${eventId}/register`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const updatedEvent = res.data?.event;
      if (updatedEvent?._id) {
        setEvents((prev) =>
          prev.map((event) => (event._id === updatedEvent._id ? updatedEvent : event))
        );
      }
      setActionMessage(res.data?.message || "Registered successfully.");
    } catch (err) {
      const errorMessage = err?.response?.data?.error || "Failed to register for event";
      setActionMessage(errorMessage);
    } finally {
      setRegisteringId("");
    }
  };

  const getStatusInfo = (event) => {
    const now = new Date();
    const { startDate, endDate, deadline } = getEventTiming(event);

    if (event.endedAt) {
      if (event.eventMode === "ranking") {
        return {
          text: event.rankingConfig?.resultsPublished ? "Results Published" : "Results Pending",
          class: event.rankingConfig?.resultsPublished ? "open" : "warning",
        };
      }
      return { text: "Event Ended", class: "closed" };
    }
    if (endDate <= now) {
      return { text: "Event Ended", class: "closed" };
    }
    if (startDate <= now && endDate > now) {
      return { text: "Ongoing", class: "live" };
    }
    if (deadline && deadline > now && startDate > now) {
      return { text: "Registration Open", class: "open" };
    }
    if (startDate > now && deadline && deadline <= now) {
      return { text: "Registration Closed", class: "warning" };
    }
    return { text: "Closed", class: "closed" };
  };

  const profileCompletionMessage = useMemo(() => {
    const incompleteFields = getIncompleteProfileFields(profile);
    if (incompleteFields.length === 0) return "";
    return `Complete your profile to register. Missing: ${incompleteFields.join(", ")}.`;
  }, [profile]);

  const visibleEvents = useMemo(() => {
    const now = new Date();
    return events.filter((event) => {
      const { endDate } = getEventTiming(event);

      if (event.eventMode === "ranking") {
        return true;
      }

      return !event.endedAt && endDate > now;
    });
  }, [events]);

  const filtered = useMemo(() => {
    let data = [...visibleEvents];
    const now = new Date();

    if (search) {
      const term = search.toLowerCase();
      data = data.filter(
        (e) =>
          e.title?.toLowerCase().includes(term) ||
          e.venue?.toLowerCase().includes(term) ||
          e.description?.toLowerCase().includes(term)
      );
    }

    if (filterType === "ongoing") {
      data = data.filter((e) => {
        const { startDate, endDate } = getEventTiming(e);
        return startDate <= now && endDate > now;
      });
    } else if (filterType === "upcoming") {
      data = data.filter((e) => new Date(e.date) > now);
    } else if (filterType === "registrationOpen") {
      data = data.filter((e) => {
        const { startDate, deadline } = getEventTiming(e);
        return startDate > now && deadline && deadline > now;
      });
    } else if (filterType === "today") {
      const today = new Date().toDateString();
      data = data.filter((e) => {
        const { startDate, endDate } = getEventTiming(e);
        return startDate.toDateString() === today || endDate.toDateString() === today;
      });
    } else if (filterType === "thisWeek") {
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      data = data.filter((e) => {
        const { startDate } = getEventTiming(e);
        return startDate >= now && startDate <= weekFromNow;
      });
    }

    if (sortBy === "date") {
      data.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortBy === "dateDesc") {
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortBy === "newest") {
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === "oldest") {
      data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === "capacity") {
      data.sort((a, b) => (b.capacity || 0) - (a.capacity || 0));
    } else if (sortBy === "title") {
      data.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }

    return data;
  }, [visibleEvents, search, filterType, sortBy]);

  const getFilterLabel = () => {
    const labels = {
      all: "All Events",
      ongoing: "Ongoing Events",
      upcoming: "Upcoming Events",
      registrationOpen: "Registration Open",
      today: "Today's Events",
      thisWeek: "This Week",
    };
    return labels[filterType] || "Filter";
  };

  const getSortLabel = () => {
    const labels = {
      dateDesc: "Date (Latest)",
      date: "Date (Earliest)",
      newest: "Newest First",
      oldest: "Oldest First",
      capacity: "Capacity (High to Low)",
      title: "Title (A-Z)",
    };
    return labels[sortBy] || "Sort";
  };

  const getVenueModalData = (event) => {
    const details = event?.venueDetails || null;

    return {
      name: details?.name || event?.venue || "Venue not announced",
      location: details?.location || "",
      description: details?.description || "",
    };
  };

  const now = new Date();
  const ongoingCount = visibleEvents.filter((e) => {
    const { startDate, endDate } = getEventTiming(e);
    return startDate <= now && endDate > now;
  }).length;
  const upcomingCount = visibleEvents.filter((e) => new Date(e.date) > now).length;
  const openRegistrationCount = visibleEvents.filter(
    (e) =>
      new Date(e.date) > now &&
      e.registrationDeadline &&
      new Date(e.registrationDeadline) > now
  ).length;

  return (
    <div className="event-wrapper">
      <div className="event-header">
        <h1 className="event-title-main">Discover Events</h1>
        <p className="event-subtitle-main">
          Explore campus experiences and register before deadlines.
        </p>
      </div>

      <div className="event-overview">
        <div className="overview-chip">
          <span className="chip-value">{visibleEvents.length}</span>
          <span className="chip-label">Visible Events</span>
        </div>
        <div className="overview-chip">
          <span className="chip-value">{ongoingCount}</span>
          <span className="chip-label">Ongoing</span>
        </div>
        <div className="overview-chip">
          <span className="chip-value">{upcomingCount}</span>
          <span className="chip-label">Upcoming</span>
        </div>
        <div className="overview-chip">
          <span className="chip-value">{openRegistrationCount}</span>
          <span className="chip-label">Open Registration</span>
        </div>
        <div className="overview-chip">
          <span className="chip-value">{filtered.length}</span>
          <span className="chip-label">Matching</span>
        </div>
      </div>

      {actionMessage ? <div className="results-info"><span>{actionMessage}</span></div> : null}

      <div className="controls">
        <div className="search-wrapper">
          <Search className="search-icon" size={20} strokeWidth={2.1} />
          <input
            type="text"
            placeholder="Search by title, venue, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="dropdown-container">
          <div className="custom-dropdown" ref={filterRef}>
            <button
              className="dropdown-trigger"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            >
              <span className="dropdown-label">{getFilterLabel()}</span>
              <ChevronDown
                className={`dropdown-arrow ${isFilterDropdownOpen ? "open" : ""}`}
                size={20}
                strokeWidth={2.1}
              />
            </button>

            {isFilterDropdownOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-menu-header">Filter Events</div>
                <div
                  className={`dropdown-item ${filterType === "all" ? "active" : ""}`}
                  onClick={() => {
                    setFilterType("all");
                    setIsFilterDropdownOpen(false);
                  }}
                >
                  <span>All Events</span>
                  {filterType === "all" && <span className="checkmark">Selected</span>}
                </div>
                <div
                  className={`dropdown-item ${filterType === "ongoing" ? "active" : ""}`}
                  onClick={() => {
                    setFilterType("ongoing");
                    setIsFilterDropdownOpen(false);
                  }}
                >
                  <span>Ongoing Events</span>
                  {filterType === "ongoing" && <span className="checkmark">Selected</span>}
                </div>
                <div
                  className={`dropdown-item ${filterType === "upcoming" ? "active" : ""}`}
                  onClick={() => {
                    setFilterType("upcoming");
                    setIsFilterDropdownOpen(false);
                  }}
                >
                  <span>Upcoming Events</span>
                  {filterType === "upcoming" && (
                    <span className="checkmark">Selected</span>
                  )}
                </div>
                <div
                  className={`dropdown-item ${
                    filterType === "registrationOpen" ? "active" : ""
                  }`}
                  onClick={() => {
                    setFilterType("registrationOpen");
                    setIsFilterDropdownOpen(false);
                  }}
                >
                  <span>Registration Open</span>
                  {filterType === "registrationOpen" && (
                    <span className="checkmark">Selected</span>
                  )}
                </div>
                <div
                  className={`dropdown-item ${filterType === "today" ? "active" : ""}`}
                  onClick={() => {
                    setFilterType("today");
                    setIsFilterDropdownOpen(false);
                  }}
                >
                  <span>Today's Events</span>
                  {filterType === "today" && <span className="checkmark">Selected</span>}
                </div>
                <div
                  className={`dropdown-item ${filterType === "thisWeek" ? "active" : ""}`}
                  onClick={() => {
                    setFilterType("thisWeek");
                    setIsFilterDropdownOpen(false);
                  }}
                >
                  <span>This Week</span>
                  {filterType === "thisWeek" && (
                    <span className="checkmark">Selected</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="custom-dropdown" ref={sortRef}>
            <button
              className="dropdown-trigger"
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
            >
              <span className="dropdown-label">{getSortLabel()}</span>
              <ChevronDown
                className={`dropdown-arrow ${isSortDropdownOpen ? "open" : ""}`}
                size={20}
                strokeWidth={2.1}
              />
            </button>

            {isSortDropdownOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-menu-header">Sort By</div>
                <div
                  className={`dropdown-item ${sortBy === "date" ? "active" : ""}`}
                  onClick={() => {
                    setSortBy("date");
                    setIsSortDropdownOpen(false);
                  }}
                >
                  <span>Date (Earliest First)</span>
                  {sortBy === "date" && <span className="checkmark">Selected</span>}
                </div>
                <div
                  className={`dropdown-item ${sortBy === "dateDesc" ? "active" : ""}`}
                  onClick={() => {
                    setSortBy("dateDesc");
                    setIsSortDropdownOpen(false);
                  }}
                >
                  <span>Date (Latest First)</span>
                  {sortBy === "dateDesc" && <span className="checkmark">Selected</span>}
                </div>
                <div className="dropdown-divider"></div>
                <div
                  className={`dropdown-item ${sortBy === "newest" ? "active" : ""}`}
                  onClick={() => {
                    setSortBy("newest");
                    setIsSortDropdownOpen(false);
                  }}
                >
                  <span>Newest First</span>
                  {sortBy === "newest" && <span className="checkmark">Selected</span>}
                </div>
                <div
                  className={`dropdown-item ${sortBy === "oldest" ? "active" : ""}`}
                  onClick={() => {
                    setSortBy("oldest");
                    setIsSortDropdownOpen(false);
                  }}
                >
                  <span>Oldest First</span>
                  {sortBy === "oldest" && <span className="checkmark">Selected</span>}
                </div>
                <div className="dropdown-divider"></div>
                <div
                  className={`dropdown-item ${sortBy === "capacity" ? "active" : ""}`}
                  onClick={() => {
                    setSortBy("capacity");
                    setIsSortDropdownOpen(false);
                  }}
                >
                  <span>Capacity (High to Low)</span>
                  {sortBy === "capacity" && <span className="checkmark">Selected</span>}
                </div>
                <div
                  className={`dropdown-item ${sortBy === "title" ? "active" : ""}`}
                  onClick={() => {
                    setSortBy("title");
                    setIsSortDropdownOpen(false);
                  }}
                >
                  <span>Title (A-Z)</span>
                  {sortBy === "title" && <span className="checkmark">Selected</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loader"></div>
          <p>Loading events...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <ImageOff className="empty-icon" size={64} strokeWidth={1.8} />
          <h3>No events found</h3>
          <p>Try adjusting your search or filter criteria.</p>
        </div>
      ) : (
        <>
          <div className="results-info">
            <span>
              Showing {filtered.length} {filtered.length === 1 ? "event" : "events"}
            </span>
          </div>

          <div className={`event-grid${filtered.length === 1 ? " is-single-result" : ""}`}>
            {filtered.map((event) => {
              const status = getStatusInfo(event);
              const { endDate } = getEventTiming(event);
              const showLeaderboardButton =
                event.eventMode === "ranking" &&
                Boolean(event.endedAt) &&
                event.rankingConfig?.resultsPublished &&
                event.leaderboard?.length > 0;
              return (
                <div key={event._id} className="event-card">
                  <div className="poster-container">
                    {event.poster ? (
                      <img
                        src={`${API_BASE}/uploads/${event.poster}`}
                        alt={event.title}
                        className="event-poster"
                      />
                    ) : (
                      <div className="poster-placeholder">
                        <ImageOff size={48} strokeWidth={1.8} />
                      </div>
                    )}
                    <span className={`status-badge ${status.class}`}>{status.text}</span>
                  </div>

                  <div className="event-content">
                    <h3 className="event-title">{event.title}</h3>
                    <p className="event-description">{event.description || "No description."}</p>

                    <div className="event-details">
                      <div className="detail-item">
                        <CalendarDays className="detail-icon" size={18} strokeWidth={2} />
                        <span>
                          {new Date(event.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          |{" "}
                          {new Date(event.date).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className="detail-item">
                        <Clock3 className="detail-icon" size={18} strokeWidth={2} />
                        <span>
                          Ends:{" "}
                          {endDate.toLocaleString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className="detail-item">
                        <MapPin className="detail-icon" size={18} strokeWidth={2} />
                        <div className="detail-content">
                          <span>{event.venue || "Venue not announced"}</span>
                          <button
                            type="button"
                            className="venue-info-trigger"
                            onClick={() => setVenueDetailsEvent(event)}
                            aria-label={`Show venue details for ${event.venue || event.title}`}
                          >
                            <Info size={15} strokeWidth={2.2} />
                          </button>
                        </div>
                      </div>

                      <div className="detail-item">
                        <Users className="detail-icon" size={18} strokeWidth={2} />
                        <span>Capacity: {event.capacity || "N/A"}</span>
                      </div>

                      <div className="detail-item deadline">
                        <CalendarDays className="detail-icon" size={18} strokeWidth={2} />
                        <span>
                          Registration Deadline:{" "}
                          {new Date(event.registrationDeadline).toLocaleString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="event-footer">
                      {showLeaderboardButton ? (
                        <button
                          type="button"
                          className="btn-register btn-leaderboard"
                          onClick={() => setLeaderboardEvent(event)}
                        >
                          <Info size={16} strokeWidth={2.1} />
                          <span>View Leaderboard</span>
                        </button>
                      ) : (
                        <button
                          className={`btn-register ${isRegistered(event) ? "is-registered" : ""}`}
                          onClick={() => handleRegister(event)}
                          disabled={!isRegistrationAllowed(event) || registeringId === event._id}
                        >
                          {registeringId === event._id
                            ? "Registering..."
                            : getRegisterButtonLabel(event)}
                        </button>
                      )}
                      {profileLoaded && !isProfileComplete(profile) ? (
                        <p className="event-helper-text">{profileCompletionMessage}</p>
                      ) : null}
                    </div>

                    {event.eventMode === "ranking" &&
                    !showLeaderboardButton &&
                    event.rankingConfig?.resultsPublished ? (
                      <div className="event-ranking-panel">
                        <div className="event-ranking-panel-card pending">
                          <span className="event-ranking-panel-label">Leaderboard Locked</span>
                          <p className="event-helper-text">
                            The leaderboard will be available once the event has ended.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {venueDetailsEvent ? (
        <div
          className="venue-modal-backdrop"
          onClick={() => setVenueDetailsEvent(null)}
          role="presentation"
        >
          <div
            className="venue-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="venue-details-title"
          >
            <div className="venue-modal-head">
              <div>
                <h3 id="venue-details-title">{getVenueModalData(venueDetailsEvent).name}</h3>
                <p>Venue details for {venueDetailsEvent.title}</p>
              </div>
              <button
                type="button"
                className="venue-modal-close"
                onClick={() => setVenueDetailsEvent(null)}
                aria-label="Close venue details"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div className="venue-modal-body">
              <div className="venue-modal-row">
                <MapPin size={18} strokeWidth={2} />
                <div>
                  <strong>Location</strong>
                  <p>{getVenueModalData(venueDetailsEvent).location || "Location not added yet."}</p>
                </div>
              </div>

              <div className="venue-modal-row">
                <Info size={18} strokeWidth={2} />
                <div>
                  <strong>Description</strong>
                  <p>
                    {getVenueModalData(venueDetailsEvent).description ||
                      "No additional venue description has been added yet."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {leaderboardEvent ? (
        <div
          className="venue-modal-backdrop"
          onClick={() => setLeaderboardEvent(null)}
          role="presentation"
        >
          <div
            className="venue-modal leaderboard-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="leaderboard-details-title"
          >
            <div className="venue-modal-head">
              <div>
                <h3 id="leaderboard-details-title">{leaderboardEvent.title} Leaderboard</h3>
                <p>Published rankings</p>
              </div>
              <button
                type="button"
                className="venue-modal-close"
                onClick={() => setLeaderboardEvent(null)}
                aria-label="Close leaderboard"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div className="venue-modal-body">
              {leaderboardEvent.leaderboard?.map((entry) => (
                <div className="venue-modal-row leaderboard-row" key={entry.userId || `${entry.rank}-${entry.name}`}>
                  <Info size={18} strokeWidth={2} />
                  <div className="leaderboard-row-content">
                    <strong>
                      #{entry.rank} {entry.name}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

export default ViewEvent;
