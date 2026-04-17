import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./css/ReportPage.css";

function ReportPage() {
  const { participantId } = useParams();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [participant, setParticipant] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchParticipant = async () => {
    try {
        const res = await axios.get(
        `http://localhost:3001/coordinator/participants/${participantId}`,
        {
            headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
        }
        );

        setParticipant(res.data);
    } catch (err) {
        console.error("Error fetching participant:", err);
    }
    };

    fetchParticipant();
  }, [participantId]);

  const handleSubmit = async () => {
    if (!reason.trim()) return alert("Please enter a reason");

    setLoading(true);
    try {
      await axios.post(
        "http://localhost:3001/reports",
        {
          participantId,
          reason,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      alert("Report submitted successfully!");
      navigate("/coordinator/ViewParticipant");
    } catch (err) {
      console.error(err.response || err);
      alert("Failed to submit report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="report-container">
      <div className="report-card">
        <h2>Report Participant</h2>

        {participant && (
          <div className="participant-info">
            <label>Username</label>
            <div className="participant-username">
              {participant.username}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Reason</label>
          <textarea
            placeholder="Enter detailed reason for reporting..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={6}
          />
        </div>

        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit Report"}
        </button>
      </div>
    </div>
  );
}

export default ReportPage;
