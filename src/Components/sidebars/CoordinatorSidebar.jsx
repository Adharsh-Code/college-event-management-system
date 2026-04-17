import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom"; 
import '../../css/sidebar.css';

function CoordinatorSidebar({ isOpen = false, onNavigate = () => {} }) {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileImage, setProfileImage] = useState("default.png");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    onNavigate();
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
          <li><Link to="/coordinator" onClick={onNavigate}>Dashboard</Link></li>
          <li><Link to="/coordinator/CreateEvent" onClick={onNavigate}>Create Event</Link></li>
          {/* <li><Link to="/coordinator" onClick={onNavigate}>Attendance</Link></li> */}
          {/* <li><Link to="/coordinator/MyEvents">My Events</Link></li> */}
          <li><Link to="/coordinator/ViewParticipant" onClick={onNavigate}>Participants</Link></li>
          <li>
            <Link to="/coordinator/Messages" onClick={handleMessagesClick}>
              Messages
              {unreadCount > 0 ? (
                <span className="sidebar-message-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </li>
          <li><Link to="/coordinator/Profile" onClick={onNavigate}>Profile</Link></li>
          {/* <li><Link to="/coordinator/Certificates">Certificates</Link></li> */}
        </ul>
      </div>

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

export default CoordinatorSidebar;
