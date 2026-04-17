import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  Award,
  CalendarDays,
  ChartColumn,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import "./css/AdminDashboard.css";

const API_BASE = "http://localhost:3001";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentActivities, setRecentActivities] = useState([]);
  const [monthlyEventsData, setMonthlyEventsData] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    const token = localStorage.getItem("token");
    setLoading(true);

    try {
      const [usersRes, eventsRes, reportsRes] = await Promise.all([
        axios.get(`${API_BASE}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE}/events`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE}/reports`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const usersData = Array.isArray(usersRes.data?.users) ? usersRes.data.users : usersRes.data || [];
      const eventsData = Array.isArray(eventsRes.data?.events) ? eventsRes.data.events : eventsRes.data || [];
      const reportsData = Array.isArray(reportsRes.data?.reports)
        ? reportsRes.data.reports
        : reportsRes.data || [];

      setUsers(usersData);
      setEvents(eventsData);
      setReports(reportsData);
      setMonthlyEventsData(buildMonthlyEventsData(eventsData));
      setRecentActivities(buildRecentActivities(usersData, eventsData, reportsData));
      setError("");
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const buildMonthlyEventsData = (eventsData) => {
    if (!eventsData?.length) {
      return MONTHS.map((month) => ({ name: month, events: 0 }));
    }

    const monthlyCounts = {};
    eventsData.forEach((event) => {
      const eventDate = new Date(event.date);
      if (Number.isNaN(eventDate.getTime())) return;

      const monthName = MONTHS[eventDate.getMonth()];
      monthlyCounts[monthName] = (monthlyCounts[monthName] || 0) + 1;
    });

    return MONTHS.map((month) => ({
      name: month,
      events: monthlyCounts[month] || 0,
    }));
  };

  const buildRecentActivities = (usersData, eventsData, reportsData) => {
    const activities = [];
    const getValidTimestamp = (value) => {
      const parsedDate = new Date(value);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
    };

    (usersData || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 3)
      .forEach((user) => {
        const timestamp = getValidTimestamp(user.createdAt);
        if (!timestamp) return;

        activities.push({
          id: `user-${user._id}`,
          type: "user",
          action: "New user registered",
          details: `${user.username} · ${user.email} · ${user.role}`,
          timestamp,
        });
      });

    (eventsData || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 3)
      .forEach((event) => {
        const timestamp = getValidTimestamp(event.createdAt);
        if (!timestamp) return;

        activities.push({
          id: `event-${event._id}`,
          type: "event",
          action: "Event created",
          details: `${event.title} · ${
            event.date ? new Date(event.date).toLocaleDateString() : "No event date"
          }`,
          timestamp,
        });
      });

    (reportsData || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 3)
      .forEach((report) => {
        const timestamp = getValidTimestamp(report.createdAt);
        if (!timestamp) return;

        const reasonPreview = report.reason
          ? `${report.reason.substring(0, 36)}${report.reason.length > 36 ? "..." : ""}`
          : "No reason provided";

        activities.push({
          id: `report-${report._id}`,
          type: "report",
          action: "New report filed",
          details: `${reasonPreview} · ${report.status}`,
          timestamp,
        });
      });

    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6)
      .map((activity) => ({
        ...activity,
        time: new Date(activity.timestamp).toLocaleString(),
      }));
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <AlertCircle className="error-icon" aria-hidden="true" />
        <p>{error}</p>
        <button onClick={fetchAllData} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  const now = new Date();

  const totalUsers = users.length;
  const participantsCount = users.filter((user) => user.role === "participant").length;
  const coordinatorsCount = users.filter((user) => user.role === "coordinator").length;
  const adminsCount = users.filter((user) => user.role === "admin").length;
  const bannedUsers = users.filter((user) => user.isBanned).length;

  const totalEvents = events.length;
  const upcomingEvents = events.filter((event) => new Date(event.date) > now).length;
  const endedEvents = events.filter((event) => Boolean(event.endedAt)).length;
  const registrationOpenEvents = events.filter((event) => {
    const eventDate = new Date(event.date);
    const deadline = new Date(event.registrationDeadline);
    return eventDate > now && deadline > now && !event.endedAt;
  }).length;

  const totalCapacity = events.reduce((sum, event) => sum + (event.capacity || 0), 0);
  const totalRegistrations = events.reduce(
    (sum, event) => sum + (Array.isArray(event.attendees) ? event.attendees.length : 0),
    0
  );
  const checkedInParticipants = events.reduce(
    (sum, event) =>
      sum +
      (event.attendees || []).filter((attendee) => attendee.status === "present").length,
    0
  );
  const absentParticipants = events.reduce(
    (sum, event) =>
      sum + (event.attendees || []).filter((attendee) => attendee.status === "absent").length,
    0
  );
  const certificatesIssued = events.reduce(
    (sum, event) =>
      sum +
      (event.attendees || []).filter((attendee) => Boolean(attendee.certificateIssuedAt)).length,
    0
  );

  const totalReports = reports.length;
  const pendingReports = reports.filter((report) => report.status === "pending").length;
  const reviewedReports = reports.filter((report) => report.status === "reviewed").length;
  const actionTakenReports = reports.filter((report) => report.status === "action_taken").length;

  const capacityUtilization = totalCapacity > 0 ? Math.round((totalRegistrations / totalCapacity) * 100) : 0;
  const attendanceRate = totalRegistrations > 0 ? Math.round((checkedInParticipants / totalRegistrations) * 100) : 0;
  const reportResolutionRate =
    totalReports > 0 ? Math.round(((reviewedReports + actionTakenReports) / totalReports) * 100) : 0;
  const avgRegistrationsPerEvent =
    totalEvents > 0 ? Math.round((totalRegistrations / totalEvents) * 10) / 10 : 0;
  const avgEventsPerMonth = (() => {
    if (!events.length) return 0;

    const validDates = events
      .map((event) => new Date(event.date))
      .filter((date) => !Number.isNaN(date.getTime()));

    if (!validDates.length) return 0;

    const minDate = new Date(Math.min(...validDates));
    const maxDate = new Date(Math.max(...validDates));
    const monthsDiff =
      (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
      (maxDate.getMonth() - minDate.getMonth()) +
      1;

    return Math.round((events.length / Math.max(monthsDiff, 1)) * 10) / 10;
  })();

  const userRoleData = [
    { name: "Administrators", value: adminsCount, color: "#ef4444" },
    { name: "Coordinators", value: coordinatorsCount, color: "#8b5cf6" },
    { name: "Participants", value: participantsCount, color: "#3b82f6" },
  ].filter((item) => item.value > 0);

  const eventStatusData = [
    { name: "Registration Open", value: registrationOpenEvents, color: "#10b981" },
    { name: "Upcoming", value: Math.max(upcomingEvents - registrationOpenEvents, 0), color: "#3b82f6" },
    { name: "Ended", value: endedEvents, color: "#64748b" },
  ].filter((item) => item.value > 0);

  const reportStatusData = [
    { name: "Pending", value: pendingReports, color: "#f59e0b" },
    { name: "Reviewed", value: reviewedReports, color: "#3b82f6" },
    { name: "Action Taken", value: actionTakenReports, color: "#10b981" },
  ].filter((item) => item.value > 0);

  const moderationSnapshot = pendingReports > 0 ? `${pendingReports} cases waiting` : "No urgent cases";
  const registrationSnapshot =
    registrationOpenEvents > 0 ? `${registrationOpenEvents} events open now` : "No active registrations";

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">System Dashboard</h1>
          <p className="dashboard-welcome">
            {totalUsers} users, {totalEvents} events, {totalReports} moderation records
          </p>
        </div>
        <div className="header-date">
          <span className="date-badge">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card users">
          <Users className="metric-icon" aria-hidden="true" />
          <div className="metric-content">
            <span className="metric-label">Total Users</span>
            <span className="metric-value">{totalUsers}</span>
            <span className="metric-trend">
              <span className="trend-neutral">
                {participantsCount} participants · {coordinatorsCount} coordinators
              </span>
            </span>
          </div>
        </div>

        <div className="metric-card events">
          <CalendarDays className="metric-icon" aria-hidden="true" />
          <div className="metric-content">
            <span className="metric-label">Events</span>
            <span className="metric-value">{totalEvents}</span>
            <span className="metric-trend">
              <span className="trend-neutral">{registrationSnapshot}</span>
            </span>
          </div>
        </div>

        <div className="metric-card attendees">
          <div className="metric-icon" aria-hidden="true">📝</div>
          <div className="metric-content">
            <span className="metric-label">Registrations</span>
            <span className="metric-value">{totalRegistrations}</span>
            <span className="metric-trend">
              <span className="trend-neutral">{avgRegistrationsPerEvent} avg per event</span>
            </span>
          </div>
        </div>

        <div className="metric-card capacity">
          <div className="metric-icon" aria-hidden="true">✅</div>
          <div className="metric-content">
            <span className="metric-label">Check-Ins</span>
            <span className="metric-value">{checkedInParticipants}</span>
            <span className="metric-trend">
              <span className="trend-neutral">{attendanceRate}% attendance rate</span>
            </span>
          </div>
        </div>

        <div className="metric-card reports">
          <Award className="metric-icon" aria-hidden="true" />
          <div className="metric-content">
            <span className="metric-label">Certificates</span>
            <span className="metric-value">{certificatesIssued}</span>
            <span className="metric-trend">
              <span className="trend-neutral">{endedEvents} events completed</span>
            </span>
          </div>
        </div>

        <div className="metric-card pending">
          <ChartColumn className="metric-icon" aria-hidden="true" />
          <div className="metric-content">
            <span className="metric-label">Pending Reports</span>
            <span className="metric-value">{pendingReports}</span>
            <span className="metric-trend">
              <span className={pendingReports > 0 ? "trend-warning" : "trend-neutral"}>
                {moderationSnapshot}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <h3 className="chart-title">
            User Role Distribution
            <span className="chart-subtitle">How access is split across the system</span>
          </h3>
          <div className="chart-container">
            {userRoleData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={userRoleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={84}>
                    {userRoleData.map((entry, index) => (
                      <Cell key={`user-role-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} users`, name]} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="no-data-message">No user data available</p>
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3 className="chart-title">
            Event Lifecycle
            <span className="chart-subtitle">Open registrations, future events, and completed ones</span>
          </h3>
          <div className="chart-container">
            {eventStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={eventStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={84}>
                    {eventStatusData.map((entry, index) => (
                      <Cell key={`event-status-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} events`, name]} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="no-data-message">No event data available</p>
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3 className="chart-title">
            Report Status
            <span className="chart-subtitle">Moderation queue and completed actions</span>
          </h3>
          <div className="chart-container">
            {reportStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={reportStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value, name) => [`${value} reports`, name]} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {reportStatusData.map((entry, index) => (
                      <Cell key={`report-status-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="no-data-message">No report data available</p>
            )}
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stats-card large">
          <h3 className="stats-card-title">
            Monthly Events Trend
            <span className="stats-subtitle">Event creation volume across the calendar year</span>
          </h3>
          <div className="stats-chart-container">
            {monthlyEventsData.some((item) => item.events > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyEventsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => [`${value} events`, "Count"]} />
                  <Line
                    type="monotone"
                    dataKey="events"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="no-data-message">No event trend data available</p>
            )}
          </div>
        </div>

        <div className="stats-card">
          <h3 className="stats-card-title">System Ratios</h3>
          <div className="quick-stats-grid">
            <div className="quick-stat-item">
              <span className="quick-stat-label">Capacity Fill Rate</span>
              <span className="quick-stat-value">{capacityUtilization}%</span>
            </div>
            <div className="quick-stat-item">
              <span className="quick-stat-label">Report Resolution Rate</span>
              <span className="quick-stat-value">{reportResolutionRate}%</span>
            </div>
            <div className="quick-stat-item">
              <span className="quick-stat-label">Average Events per Month</span>
              <span className="quick-stat-value">{avgEventsPerMonth}</span>
            </div>
            <div className="quick-stat-item">
              <span className="quick-stat-label">Banned Users</span>
              <span className="quick-stat-value">{bannedUsers}</span>
            </div>
            <div className="quick-stat-item">
              <span className="quick-stat-label">Absent Markings</span>
              <span className="quick-stat-value">{absentParticipants}</span>
            </div>
            <div className="quick-stat-item">
              <span className="quick-stat-label">Admin Accounts</span>
              <span className="quick-stat-value">{adminsCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="activities-section">
        <h3 className="activities-title">Recent Activities</h3>
        <div className="activities-list">
          {recentActivities.length > 0 ? (
            recentActivities.map((activity) => (
              <div key={activity.id} className={`activity-item ${activity.type}`}>
                <div className="activity-icon">
                  {activity.type === "user" && <UserRound aria-hidden="true" />}
                  {activity.type === "event" && <CalendarDays aria-hidden="true" />}
                  {activity.type === "report" && <ShieldAlert aria-hidden="true" />}
                </div>
                <div className="activity-content">
                  <p className="activity-action">{activity.action}</p>
                  <p className="activity-details">{activity.details}</p>
                  <span className="activity-time">{activity.time}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="no-activities">No recent activities</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;

