import { useEffect, useState } from "react";
import "./css/CreateEvent.css";

const API_BASE = "http://localhost:3001";

function CreateEvent() {
  const initialState = {
    title: "",
    description: "",
    date: "",
    time: "",
    endDate: "",
    endTime: "",
    venue: "",
    venueId: "",
    capacity: "1",
    registrationDeadline: "",
    poster: null,
    eventMode: "standard",
    metricLabel: "Rank",
    metricUnit: "",
    rankingOrder: "lower",
  };

  const [formData, setFormData] = useState(initialState);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [availability, setAvailability] = useState({
    loading: false,
    checked: false,
    available: false,
    conflicts: [],
    error: "",
  });

  const selectedVenue =
    venues.find((venue) => venue._id === formData.venueId) || null;

  useEffect(() => {
    let ignore = false;

    const loadVenues = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE}/venues`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load venues");
        }

        if (!ignore) {
          setVenues(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!ignore) {
          setMessage((prev) =>
            prev.text ? prev : { type: "error", text: err.message }
          );
        }
      }
    };

    loadVenues();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const checkAvailability = async () => {
      if (
        !formData.venueId ||
        !formData.date ||
        !formData.time ||
        !formData.endDate ||
        !formData.endTime
      ) {
        if (!ignore) {
          setAvailability({
            loading: false,
            checked: false,
            available: false,
            conflicts: [],
            error: "",
          });
        }
        return;
      }

      const startDate = new Date(`${formData.date}T${formData.time}`);
      const endDate = new Date(`${formData.endDate}T${formData.endTime}`);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        if (!ignore) {
          setAvailability({
            loading: false,
            checked: false,
            available: false,
            conflicts: [],
            error: "",
          });
        }
        return;
      }

      try {
        if (!ignore) {
          setAvailability((prev) => ({
            ...prev,
            loading: true,
            error: "",
          }));
        }

        const token = localStorage.getItem("token");
        const params = new URLSearchParams({
          venueId: formData.venueId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const response = await fetch(`${API_BASE}/venues/availability?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to check venue availability");
        }

        if (!ignore) {
          setAvailability({
            loading: false,
            checked: true,
            available: Boolean(data.available),
            conflicts: Array.isArray(data.conflicts) ? data.conflicts : [],
            error: "",
          });
        }
      } catch (err) {
        if (!ignore) {
          setAvailability({
            loading: false,
            checked: true,
            available: false,
            conflicts: [],
            error: err.message,
          });
        }
      }
    };

    checkAvailability();

    return () => {
      ignore = true;
    };
  }, [
    formData.venueId,
    formData.date,
    formData.time,
    formData.endDate,
    formData.endTime,
  ]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "poster") {
      setFormData((prev) => ({
        ...prev,
        poster: files[0] || null,
      }));
    } else if (name === "venueId") {
      const matchedVenue = venues.find((venue) => venue._id === value) || null;
      setFormData((prev) => ({
        ...prev,
        venue: matchedVenue?.name || "",
        venueId: value,
      }));
    } else if (name === "eventMode") {
      setFormData((prev) => ({
        ...prev,
        eventMode: value,
        metricLabel: value === "ranking" ? "Rank" : "",
        metricUnit: "",
        rankingOrder: value === "ranking" ? "lower" : "higher",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: name === "capacity" ? value : value,
      }));
    }
  };

  const validateForm = () => {
    const {
      title,
      description,
      date,
      time,
      endDate,
      endTime,
      capacity,
      registrationDeadline,
      eventMode,
      metricLabel,
    } = formData;

    if (!title.trim()) return "Title is required";
    if (!description.trim()) return "Description is required";
    if (!date || !time) return "Event date and time required";
    if (!endDate || !endTime) return "Event end date and time required";
    if (!formData.venueId) return "Please select a venue";
    if (!registrationDeadline) return "Registration deadline required";
    const normalizedCapacity = Number(capacity);

    if (!String(capacity).trim()) return "Capacity is required";
    if (!Number.isFinite(normalizedCapacity) || normalizedCapacity < 1) {
      return "Capacity must be at least 1";
    }
    if (selectedVenue?.capacity && normalizedCapacity > selectedVenue.capacity) {
      return `Capacity cannot exceed venue capacity of ${selectedVenue.capacity}`;
    }

    const eventDateTime = new Date(`${date}T${time}`);
    const eventEndDateTime = new Date(`${endDate}T${endTime}`);
    const deadline = new Date(registrationDeadline);
    const now = new Date();

    if (eventEndDateTime <= eventDateTime)
      return "Event end must be after the start time";

    if (deadline >= eventDateTime)
      return "Registration deadline must be before event";

    if (deadline <= now)
      return "Registration deadline cannot be in the past";

    if (availability.checked && !availability.loading && !availability.available)
      return "Selected venue is not available for this date and time";

    if (eventMode === "ranking" && !metricLabel.trim()) {
      return "Ranking events need a result label";
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    const error = validateForm();
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage({ type: "error", text: "Login required" });
      return;
    }

    try {
      setLoading(true);

      // Combine date & time into ISO string
      const eventDateTimeISO = new Date(
        `${formData.date}T${formData.time}`
      ).toISOString();
      const eventEndDateTimeISO = new Date(
        `${formData.endDate}T${formData.endTime}`
      ).toISOString();

      const deadlineISO = new Date(
        formData.registrationDeadline
      ).toISOString();

      // MUST use FormData
      const submitData = new FormData();
      submitData.append("title", formData.title.trim());
      submitData.append("description", formData.description.trim());
      submitData.append("date", eventDateTimeISO);
      submitData.append("endDate", eventEndDateTimeISO);
      submitData.append("venue", formData.venue.trim());
      submitData.append("venueId", formData.venueId);
      submitData.append("capacity", String(Number(formData.capacity)));
      submitData.append("registrationDeadline", deadlineISO);
      submitData.append("eventMode", formData.eventMode);
      submitData.append(
        "metricLabel",
        formData.eventMode === "ranking" ? "Rank" : formData.metricLabel.trim()
      );
      submitData.append("metricUnit", "");
      submitData.append(
        "rankingOrder",
        formData.eventMode === "ranking" ? "lower" : formData.rankingOrder
      );

      if (formData.poster) {
        submitData.append("poster", formData.poster);
      }

      const response = await fetch(`${API_BASE}/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`, // DO NOT set Content-Type manually
        },
        body: submitData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to create event");
      }

      setMessage({ type: "success", text: "Event created successfully." });
      setFormData(initialState);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-event-container">
      <div className="create-event-header">
        <h2>Create Event</h2>
        <p>Schedule a new event and upload A4 poster.</p>
      </div>

      {message.text && (
        <div className={`form-${message.type}`}>
          {message.text}
        </div>
      )}

      <form
        className="create-event-form"
        onSubmit={handleSubmit}
        encType="multipart/form-data"
      >
        <label>
          Title *
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Event Type *
          <select
            name="eventMode"
            value={formData.eventMode}
            onChange={handleChange}
            required
            className="create-event-type-select"
          >
            <option value="standard">Standard Event</option>
            <option value="ranking">Ranking Event</option>
          </select>
        </label>

        <label>
          Date *
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Time *
          <input
            type="time"
            name="time"
            value={formData.time}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          End Date *
          <input
            type="date"
            name="endDate"
            value={formData.endDate}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          End Time *
          <input
            type="time"
            name="endTime"
            value={formData.endTime}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Registration Deadline *
          <input
            type="datetime-local"
            name="registrationDeadline"
            value={formData.registrationDeadline}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Venue *
          <select
            name="venueId"
            value={formData.venueId}
            onChange={handleChange}
            required
          >
            <option value="">Select venue</option>
            {venues.map((venue) => (
              <option key={venue._id} value={venue._id}>
                {venue.name}
              </option>
            ))}
          </select>
          <span className="create-event-hint">
            Venues are managed by admin. Ask an admin to add a new venue if it is missing.
          </span>
          {selectedVenue?.capacity ? (
            <span className="create-event-meta">
              Venue capacity: {selectedVenue.capacity}
            </span>
          ) : null}
          {availability.loading ? (
            <span className="create-event-status checking">Checking venue availability...</span>
          ) : availability.error ? (
            <span className="create-event-status error">{availability.error}</span>
          ) : availability.checked ? (
            availability.available ? (
              <span className="create-event-status success">Venue is available for this time slot.</span>
            ) : (
              <div className="create-event-status error conflict-list">
                <span>Venue is already booked for this time slot.</span>
                {availability.conflicts.map((conflict) => (
                  <span key={conflict._id} className="create-event-conflict-item">
                    {conflict.title}: {new Date(conflict.date).toLocaleString()} to{" "}
                    {new Date(conflict.endDate).toLocaleString()}
                  </span>
                ))}
              </div>
            )
          ) : null}
        </label>

        <label>
          Capacity *
          <input
            type="number"
            name="capacity"
            min="1"
            value={formData.capacity}
            onChange={handleChange}
            required
          />
          {selectedVenue?.capacity ? (
            <span className="create-event-hint">
              Maximum allowed for this venue: {selectedVenue.capacity}
            </span>
          ) : null}
        </label>

        <label>
          Poster (A4 Image)
          <input
            type="file"
            name="poster"
            accept="image/*"
            onChange={handleChange}
          />
        </label>

        <label className="full-width">
          Description *
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
          />
        </label>

        <div className="form-actions">
          <button
            type="submit"
            className="create-btn"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Event"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateEvent;
