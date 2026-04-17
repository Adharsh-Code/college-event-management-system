import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import '../../css/sidebar.css';

function AdminSidebar({ isOpen = false, onNavigate = () => {} }) {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileImage, setProfileImage] = useState("default.png");

  const handleLogout = () => {
    // Remove token or user info from localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    onNavigate();

    // Redirect to login page
    navigate("/");
  };

  const username = localStorage.getItem("username");
  const email = localStorage.getItem("email");
  const handleMessagesClick = () => {
    setUnreadCount(0);
    onNavigate();
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchUnread = async () => {
      try {
        const response = await fetch("http://localhost:3001/conversations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        const totalUnread = Array.isArray(data)
          ? data.reduce((sum, item) => sum + (item.unreadCount || 0), 0)
          : 0;
        setUnreadCount(totalUnread);
      } catch {
        // Ignore badge errors in sidebar
      }
    };

    fetchUnread();
    const intervalId = setInterval(fetchUnread, 15000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchProfile = async () => {
      try {
        const response = await fetch("http://localhost:3001/users/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        setProfileImage(data?.profileImage || "default.png");
      } catch {
        // Ignore profile image errors in sidebar
      }
    };

    fetchProfile();
  }, []);

  const avatarUrl =
    profileImage && profileImage !== "default.png"
      ? `http://localhost:3001/uploads/${profileImage}`
      : "http://localhost:3001/uploads/default.png";

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-top">
        <ul className="sidebar-menu">
          <li><Link to="/admin" onClick={onNavigate}>Dashboard</Link></li>
          <li><Link to="/admin/Events" onClick={onNavigate}>Manage Events</Link></li>
          <li><Link to="/admin/Venues" onClick={onNavigate}>Venues</Link></li>
          <li><Link to="/admin/Users" onClick={onNavigate}>Users</Link></li>
          <li><Link to="/admin/Reports" onClick={onNavigate}>Reports</Link></li>
          <li>
            <Link to="/admin/Messages" onClick={handleMessagesClick}>
              Messages
              {unreadCount > 0 ? (
                <span className="sidebar-message-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </li>
          <li><Link to="/admin/Profile" onClick={onNavigate}>Profile</Link></li>
        </ul>
      </div>

      {/* Logout button at bottom */}
      <div className="sidebar-bottom">
        {username && email && (
          <div className="user-info">
            <div className="avatar">
              <img
                src={avatarUrl}
                alt={username}
                onError={(event) => {
                  event.currentTarget.src = "http://localhost:3001/uploads/default.png";
                }}
              />
            </div>
            <div className="user-details">
              <p className="name">{username}</p>
              <p className="email">{email}</p>
            </div>
          </div>
        )}
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
