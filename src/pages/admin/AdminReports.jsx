import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./css/AdminReports.css";

const API_URL = "http://localhost:3001";

function AdminReports() {
  const [reports, setReports] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await axios.patch(
        `${API_URL}/reports/${id}`,
        { status: newStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Optimistic update instead of refetching everything
      setReports((prev) =>
        prev.map((report) =>
          report._id === id ? { ...report, status: newStatus } : report
        )
      );
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const formatStatus = (status) => {
    return status.replace("_", " ");
  };

  const formatReportDateTime = (dateValue) => {
    if (!dateValue) return "N/A";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getBanState = (report) => {
    const participant = report.participantId;
    if (!participant?.isBanned) return "not_banned";
    if (participant.bannedUntil && new Date(participant.bannedUntil) < new Date()) {
      return "expired";
    }
    return participant.bannedUntil ? "temporarily_banned" : "permanently_banned";
  };

  const banParticipant = async (report, { days, permanent }) => {
    try {
      const banUntil =
        permanent ? null : new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000);

      const { data } = await axios.patch(
        `${API_URL}/reports/${report._id}/ban-participant`,
        {
          bannedUntil: banUntil ? banUntil.toISOString() : null,
          permanent: Boolean(permanent),
          reason: report.reason,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setReports((prev) =>
        prev.map((item) =>
          item._id === report._id
            ? {
                ...item,
                status: "action_taken",
                participantId: {
                  ...item.participantId,
                  isBanned: true,
                  bannedUntil: data?.participant?.bannedUntil || null,
                },
              }
            : item
        )
      );
    } catch (error) {
      console.error("Failed to ban participant:", error);
      alert(error?.response?.data?.error || "Failed to ban participant");
    }
  };

  const handleBanClick = async (report) => {
    const promptValue = window.prompt(
      "Choose ban duration: 1, 3, 7, 30, or permanent",
      "7"
    );
    if (promptValue === null) return;

    const selection = promptValue.trim().toLowerCase();

    if (selection === "permanent" || selection === "p") {
      await banParticipant(report, { permanent: true });
      return;
    }

    const allowedDays = [1, 3, 7, 30];
    const days = Number(selection);
    if (!allowedDays.includes(days)) {
      alert("Please choose only one of these values: 1, 3, 7, 30, permanent.");
      return;
    }

    await banParticipant(report, { days, permanent: false });
  };

  const sendWarningMessage = async (participantId, reason) => {
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    const { data: conversation } = await axios.post(
      `${API_URL}/conversations`,
      { participantId },
      authHeaders
    );

    const warningText = `Warning from admin: ${reason || "No reason provided."}. \n\nPlease follow community guidelines to avoid further action.`;

    await axios.post(
      `${API_URL}/conversations/${conversation._id}/messages`,
      { content: warningText },
      authHeaders
    );
  };

  const handleSendWarning = async (report) => {
    const warningReason = report.reason || "No reason provided";
    const shouldSendWarning = window.confirm(
      `Give warning for the reason - ${warningReason}`
    );

    if (!shouldSendWarning) return;
    if (!report.participantId?._id) {
      alert("Participant not found for this report.");
      return;
    }

    try {
      await sendWarningMessage(report.participantId._id, warningReason);
      await updateStatus(report._id, "action_taken");
      alert("Warning sent successfully.");
    } catch (error) {
      console.error("Failed to send warning:", error);
      alert(error?.response?.data?.error || "Failed to send warning.");
    }
  };

  const reportStats = useMemo(() => {
    const pending = reports.filter((item) => item.status === "pending").length;
    const reviewed = reports.filter((item) => item.status === "reviewed").length;
    const actionTaken = reports.filter((item) => item.status === "action_taken").length;
    const banned = new Set(
      reports
        .filter((item) => {
          const banState = getBanState(item);
          return banState === "temporarily_banned" || banState === "permanently_banned";
        })
        .map((item) => item.participantId?._id)
        .filter(Boolean)
    ).size;

    return {
      total: reports.length,
      pending,
      reviewed,
      actionTaken,
      banned,
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    let result = reports.filter((report) => {
      const matchesSearch =
        report.participantId?.username?.toLowerCase().includes(search) ||
        report.participantId?.email?.toLowerCase().includes(search) ||
        report.coordinatorId?.username?.toLowerCase().includes(search) ||
        report.reason?.toLowerCase().includes(search);
      const banState = getBanState(report);
      const matchesStatus = (() => {
        if (statusFilter === "all") return true;
        if (statusFilter === "banned") {
          return banState === "temporarily_banned" || banState === "permanently_banned";
        }
        if (statusFilter === "expired") {
          return banState === "expired";
        }
        return report.status === statusFilter;
      })();
      return matchesSearch && matchesStatus;
    });

    result = [...result];
    if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortBy === "oldest") {
      result.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    }

    return result;
  }, [reports, searchTerm, statusFilter, sortBy]);

  return (
    <div className="admin-reports-container">
      <div className="admin-reports-card">
        <div className="admin-reports-header">
          <div>
            <h2 className="admin-reports-title">Reports Management</h2>
            <p className="admin-reports-subtitle">
              Review participant reports, apply actions, and manage temporary bans.
            </p>
          </div>
          <div className="admin-reports-stats">
            <div className="report-stat-chip">
              <span>{reportStats.total}</span>
              <small>Total</small>
            </div>
            <div className="report-stat-chip pending">
              <span>{reportStats.pending}</span>
              <small>Pending</small>
            </div>
            <div className="report-stat-chip reviewed">
              <span>{reportStats.reviewed}</span>
              <small>Reviewed</small>
            </div>
            <div className="report-stat-chip action-taken">
              <span>{reportStats.actionTaken}</span>
              <small>Action</small>
            </div>
            <div className="report-stat-chip banned">
              <span>{reportStats.banned}</span>
              <small>Banned</small>
            </div>
          </div>
        </div>

        <div className="admin-reports-controls">
          <input
            type="text"
            className="report-search"
            placeholder="Search by user, coordinator, reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="report-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="action_taken">Action Taken</option>
            <option value="banned">Banned</option>
            <option value="expired">Expired Ban</option>
          </select>
          <select
            className="report-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Coordinator</th>
                <th>Reason</th>
                <th>Reported At</th>
                <th>Report Status</th>
                <th>Participant Ban</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">
                    No reports found for the current filters.
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <tr key={report._id}>
                    <td className="participant-cell">
                      <div className="participant-name">{report.participantId?.username || "N/A"}</div>
                      <div className="participant-email">
                        {report.participantId?.email || "No email"}
                      </div>
                    </td>
                    <td>{report.coordinatorId?.username || "N/A"}</td>
                    <td className="reason-cell">{report.reason}</td>
                    <td className="report-time-cell">{formatReportDateTime(report.createdAt)}</td>

                    <td className="status-cell">
                      <span
                        className={`admin-report-status-badge admin-report-status-${report.status}`}
                      >
                        {formatStatus(report.status)}
                      </span>
                    </td>

                    <td className="status-cell">
                      {(() => {
                        const banState = getBanState(report);

                        if (banState === "temporarily_banned") {
                          return (
                            <>
                              <span className="admin-report-status-badge admin-report-status-banned">
                                temporarily banned
                              </span>
                              <div className="status-subtext">
                                Until {new Date(report.participantId.bannedUntil).toLocaleString()}
                              </div>
                            </>
                          );
                        }

                        if (banState === "permanently_banned") {
                          return (
                            <>
                              <span className="admin-report-status-badge admin-report-status-banned">
                                permanently banned
                              </span>
                              {/* <div className="status-subtext">No end date</div> */}
                            </>
                          );
                        }

                        if (banState === "expired") {
                          return (
                            <>
                              <span className="admin-report-status-badge admin-report-status-expired">
                                ban expired
                              </span>
                              <div className="status-subtext">
                                Ended {new Date(report.participantId.bannedUntil).toLocaleString()}
                              </div>
                            </>
                          );
                        }

                        return (
                          <span className="admin-report-status-badge admin-report-status-clear">
                            not banned
                          </span>
                        );
                      })()}
                    </td>

                    <td className="action-cell">
                      {(() => {
                        const banState = getBanState(report);

                        if (report.status === "action_taken") {
                          return (
                            <div className="action-group">
                              <span className="action-text">
                                {banState === "temporarily_banned" || banState === "permanently_banned"
                                  ? "Action taken - participant banned"
                                  : "Action taken"}
                              </span>
                            </div>
                          );
                        }

                        if (report.status === "pending") {
                          return (
                            <div className="action-group">
                              <button
                                className="action-btn review-btn"
                                onClick={() => updateStatus(report._id, "reviewed")}
                              >
                                Mark as Reviewed
                              </button>
                            </div>
                          );
                        }

                        if (report.status === "reviewed") {
                          return (
                            <div className="action-group">
                              <button
                                className="action-btn ban-btn"
                                onClick={() => handleBanClick(report)}
                                disabled={
                                  !report.participantId?._id ||
                                  banState === "temporarily_banned" ||
                                  banState === "permanently_banned"
                                }
                              >
                                {banState === "temporarily_banned" || banState === "permanently_banned"
                                  ? "Already Banned"
                                  : "Ban"}
                              </button>
                              <button
                                className="action-btn warning-btn"
                                onClick={() => handleSendWarning(report)}
                              >
                                Send Warning
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminReports;
