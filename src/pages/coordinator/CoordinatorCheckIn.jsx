import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import QrScanner from "qr-scanner";
import { BadgeCheck, Clock3, Mail, ScanLine, User } from "lucide-react";
import "./css/CoordinatorCheckIn.css";

const API_BASE = "http://localhost:3001";

function CoordinatorCheckIn() {
  const { eventId } = useParams();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scannerRef = useRef(null);
  const [eventInfo, setEventInfo] = useState(null);
  const [tokenInput, setTokenInput] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [scannerCheckIns, setScannerCheckIns] = useState([]);

  const getStatusLabel = (status) => {
    if (!status) return "Unknown";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const [eventResponse, checkInsResponse] = await Promise.all([
          axios.get(`${API_BASE}/coordinator/events/${eventId}/attendees`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE}/coordinator/events/${eventId}/scanner-checkins`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setEventInfo(eventResponse.data);
        setScannerCheckIns(Array.isArray(checkInsResponse.data?.checkIns) ? checkInsResponse.data.checkIns : []);
      } catch (err) {
        setError(err?.response?.data?.error || "Failed to load event attendance");
      } finally {
        setLoading(false);
      }
    };

    fetchPageData();

    const hasCamera = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
    setCameraSupported(hasCamera);

    return () => {
      stopCamera();
    };
  }, [eventId]);

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCameraActive(false);
    setCameraVisible(false);
  };

  const submitCheckIn = async (overrideToken) => {
    const tokenValue = String(overrideToken ?? tokenInput).trim();
    if (!tokenValue || submitting) return;

    try {
      setSubmitting(true);
      setActionMessage("");
      setError("");
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE}/coordinator/events/${eventId}/check-in`,
        { token: tokenValue },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data?.attendee) {
        setScannerCheckIns((current) => {
          const next = current.filter((entry) => entry._id !== response.data.attendee._id);
          return [response.data.attendee, ...next].sort(
            (left, right) => new Date(right.checkedInAt || 0) - new Date(left.checkedInAt || 0)
          );
        });
      }
      setActionMessage(response.data?.message || "Check-in completed");
      setTokenInput("");
      stopCamera();

      if (response.data?.attendee?.status === "present") {
        setEventInfo((current) =>
          current
            ? {
                ...current,
                counts: {
                  ...current.counts,
                  present: response.data.alreadyCheckedIn
                    ? current.counts.present
                    : current.counts.present + 1,
                  registered: response.data.alreadyCheckedIn
                    ? current.counts.registered
                    : Math.max(0, current.counts.registered - 1),
                },
              }
            : current
        );
      }
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to check in participant");
    } finally {
      setSubmitting(false);
    }
  };

  const startCamera = async () => {
    if (!cameraSupported || cameraActive) return;

    try {
      if (!videoRef.current) {
        return;
      }

      setCameraVisible(true);

      const scanner = new QrScanner(
        videoRef.current,
        async (result) => {
          const tokenValue = typeof result === "string" ? result : result?.data;
          if (!tokenValue) return;

          scanner.stop();
          setCameraActive(false);
          await submitCheckIn(tokenValue);
        },
        {
          preferredCamera: "environment",
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
        }
      );

      scannerRef.current = scanner;
      await scanner.start();
      setCameraActive(true);

      const stream = videoRef.current.srcObject;
      if (stream && typeof stream.getTracks === "function") {
        streamRef.current = stream;
      }

    } catch (err) {
      setError(err?.message || "Unable to start camera scanner");
      stopCamera();
    }
  };

  if (loading) {
    return <div className="coordinator-checkin-state">Loading attendance scanner...</div>;
  }

  if (error && !eventInfo) {
    return <div className="coordinator-checkin-state coordinator-checkin-error">{error}</div>;
  }

  return (
    <div className="coordinator-checkin-page">
      <div className="coordinator-checkin-header">
        <div>
          <p className="coordinator-checkin-eyebrow">Scanner Check-In</p>
          <h1>{eventInfo?.eventTitle || "Event"}</h1>
          {eventInfo?.endedAt ? (
            <p>Event ended on {new Date(eventInfo.endedAt).toLocaleString()}</p>
          ) : (
            <p>Use a scanner device, pasted token, or supported browser camera scan.</p>
          )}
        </div>
        <div className="coordinator-checkin-header-actions">
          <Link to={`/coordinator/events/${eventId}/participants`} className="coordinator-checkin-link">
            Manage Attendance
          </Link>
          <Link to="/coordinator" className="coordinator-checkin-link secondary">
            Dashboard
          </Link>
        </div>
      </div>

      <section className="coordinator-checkin-stats">
        <article>
          <strong>{eventInfo?.counts?.total || 0}</strong>
          <span>Total</span>
        </article>
        <article>
          <strong>{eventInfo?.counts?.present || 0}</strong>
          <span>Present</span>
        </article>
        <article>
          <strong>{eventInfo?.counts?.registered || 0}</strong>
          <span>Pending</span>
        </article>
        <article>
          <strong>{eventInfo?.counts?.absent || 0}</strong>
          <span>Absent</span>
        </article>
      </section>

      <section className="coordinator-checkin-panel">
        <div className="coordinator-checkin-manual">
          <h2>Scan or Paste Token</h2>
          <div className="coordinator-checkin-input-row">
            <input
              type="text"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitCheckIn();
                }
              }}
              placeholder="Paste a check-in token or use a handheld scanner"
              disabled={Boolean(eventInfo?.endedAt)}
            />
            <button
              type="button"
              onClick={() => submitCheckIn()}
              disabled={!tokenInput.trim() || submitting || Boolean(eventInfo?.endedAt)}
            >
              {submitting ? "Checking In..." : "Check In"}
            </button>
          </div>

          {cameraSupported ? (
            <div className="coordinator-checkin-camera-tools">
              <button
                type="button"
                onClick={cameraActive ? stopCamera : startCamera}
                disabled={Boolean(eventInfo?.endedAt)}
              >
                {cameraActive ? "Stop Camera" : "Start Camera"}
              </button>
              <small>Dedicated QR scanning is enabled for this browser.</small>
            </div>
          ) : (
            <p className="coordinator-checkin-note">
              This browser does not expose camera access here. Use a handheld scanner or paste the
              token manually.
            </p>
          )}

          <div
            className={`coordinator-checkin-camera ${
              cameraVisible ? (cameraActive ? "is-active" : "is-starting") : "is-hidden"
            }`}
          >
            <video ref={videoRef} muted playsInline />
          </div>
        </div>

        <div className="coordinator-checkin-results">
          <h2>Latest Result</h2>
          {actionMessage ? <div className="coordinator-checkin-banner">{actionMessage}</div> : null}
          {error ? <div className="coordinator-checkin-banner error">{error}</div> : null}

          {scannerCheckIns.length > 0 ? (
            <div className="coordinator-checkin-history">
              {scannerCheckIns.map((checkIn) => (
                <div className="coordinator-checkin-result-card" key={checkIn._id}>
                  <div className="coordinator-checkin-result-head">
                    <h3>{checkIn.user?.fullName || checkIn.user?.username || "Participant"}</h3>
                    <p>Scanner result details</p>
                  </div>

                  <div className="coordinator-checkin-result-body">
                    <div className="coordinator-checkin-result-row">
                      <User size={18} strokeWidth={2} />
                      <div>
                        <strong>Participant</strong>
                        <p>{checkIn.user?.fullName || checkIn.user?.username || "Participant"}</p>
                      </div>
                    </div>

                    <div className="coordinator-checkin-result-row">
                      <Mail size={18} strokeWidth={2} />
                      <div>
                        <strong>Email</strong>
                        <p>{checkIn.user?.email || "No email available"}</p>
                      </div>
                    </div>

                    <div className="coordinator-checkin-result-row">
                      <BadgeCheck size={18} strokeWidth={2} />
                      <div>
                        <strong>Status</strong>
                        <p>{getStatusLabel(checkIn.status)}</p>
                      </div>
                    </div>

                    <div className="coordinator-checkin-result-row">
                      <Clock3 size={18} strokeWidth={2} />
                      <div>
                        <strong>Checked In</strong>
                        <p>
                          {checkIn.checkedInAt
                            ? new Date(checkIn.checkedInAt).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="coordinator-checkin-result-row">
                      <ScanLine size={18} strokeWidth={2} />
                      <div>
                        <strong>Method</strong>
                        <p>{checkIn.checkInMethod || "manual"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="coordinator-checkin-note">
              No participant has been checked in with the scanner yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default CoordinatorCheckIn;
