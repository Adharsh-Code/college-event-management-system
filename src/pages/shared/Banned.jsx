import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./css/Banned.css";

function Banned() {
  const location = useLocation();
  const navigate = useNavigate();

  const banInfo = useMemo(() => {
    if (location.state) return location.state;
    try {
      const stored = localStorage.getItem("banInfo");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [location.state]);

  const isPermanent = Boolean(banInfo?.permanent);
  const untilText =
    !isPermanent && banInfo?.bannedUntil
      ? new Date(banInfo.bannedUntil).toLocaleString()
      : null;

  return (
    <div className="banned-page">
      <div className="banned-card">
        <h1>Account Restricted</h1>
        <p className="banned-message">
          {banInfo?.message || "Your account is currently restricted by admin."}
        </p>
        {banInfo?.banReason ? (
          <p className="banned-detail">Reason: {banInfo.banReason}</p>
        ) : null}
        {isPermanent ? (
          <p className="banned-detail">Ban type: Permanent</p>
        ) : untilText ? (
          <p className="banned-detail">Ban ends: {untilText}</p>
        ) : null}
        <button type="button" onClick={() => navigate("/Login")}>
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default Banned;
