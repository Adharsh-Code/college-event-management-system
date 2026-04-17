import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertCircle, Search, Trash2, X } from "lucide-react";
import "./css/ViewUsers.css";

function ViewUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [actionMessage, setActionMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const token = localStorage.getItem("token");
  const baseURL = "http://localhost:3001";
  const currentUserEmail = localStorage.getItem("email");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    if (!token) {
      setError("You are not logged in. Please log in to view users.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await axios.get(`${baseURL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUsers(res.data.users || res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Unauthorized access. Your session may have expired.");
      } else {
        setError("Failed to fetch users. Please try again later.");
      }
      console.error("Fetch users error:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId, newRole) => {
    const selectedUser = users.find((user) => user._id === userId);
    if (selectedUser?.email === currentUserEmail && newRole !== "admin") {
      setActionMessage("You cannot remove your own admin role.");
      return;
    }

    setUpdatingUserId(userId);
    try {
      await axios.put(
        `${baseURL}/users/${userId}`,
        { role: newRole },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user._id === userId ? { ...user, role: newRole } : user
        )
      );
      setActionMessage("Role updated successfully.");
    } catch (err) {
      console.error("Failed to update role:", err);
      setActionMessage("Failed to update role. Check your permissions.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const deleteUser = async (userId) => {
    const selectedUser = users.find((user) => user._id === userId);
    if (selectedUser?.email === currentUserEmail) {
      setActionMessage("You cannot delete your own account.");
      return;
    }

    if (window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      setDeletingUserId(userId);
      try {
        await axios.delete(`${baseURL}/users/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setUsers((prevUsers) => prevUsers.filter((user) => user._id !== userId));
        setActionMessage("User deleted successfully.");
      } catch (err) {
        console.error("Failed to delete user:", err);
        setActionMessage("Failed to delete user.");
      } finally {
        setDeletingUserId(null);
      }
    }
  };

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase().trim();

    const result = users.filter((user) => {
      const matchesSearch =
        user.username?.toLowerCase().includes(normalizedSearch) ||
        user.email?.toLowerCase().includes(normalizedSearch) ||
        user.role?.toLowerCase().includes(normalizedSearch);

      const matchesRole =
        roleFilter === "all" ? true : user.role === roleFilter;

      return matchesSearch && matchesRole;
    });

    const sorted = [...result];
    if (sortBy === "newest") {
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortBy === "oldest") {
      sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    } else if (sortBy === "nameAsc") {
      sorted.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
    } else if (sortBy === "nameDesc") {
      sorted.sort((a, b) => (b.username || "").localeCompare(a.username || ""));
    }

    return sorted;
  }, [users, searchTerm, roleFilter, sortBy]);

  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setSortBy("newest");
  };

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'admin': return '#3b82f6';
      case 'coordinator': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  const formatJoinedDate = (createdAt) => {
    if (!createdAt) return "N/A";
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString();
  };

  const formatJoinedDateTime = (createdAt) => {
    if (!createdAt) return "N/A";
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString();
  };

  return (
    <div className="view-users-container">
      {/* Header Section */}
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">User Management</h1>
          
        </div>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-value">{users.length}</span>
            <span className="stat-label">Total Users</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {users.filter(u => u.role === 'admin').length}
            </span>
            <span className="stat-label">Admins</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {users.filter(u => u.role === 'coordinator').length}
            </span>
            <span className="stat-label">Coordinators</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {users.filter(u => u.role === 'participant').length}
            </span>
            <span className="stat-label">Participants</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="search-section">
        <div className="search-wrapper">
          <Search className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="search-input"
            placeholder="Search users by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters-row">
          <select
            className="control-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="coordinator">Coordinator</option>
            <option value="participant">Participant</option>
          </select>

          <select
            className="control-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="nameAsc">Name A-Z</option>
            <option value="nameDesc">Name Z-A</option>
          </select>

          <button type="button" className="clear-search" onClick={clearFilters}>
            Reset
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="action-message">
          {actionMessage}
        </div>
      )}

      {/* Main Content */}
      <div className="content-wrapper">
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading users...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <AlertCircle className="error-icon" aria-hidden="true" />
            <p>{error}</p>
            <button onClick={fetchUsers} className="retry-btn">Try Again</button>
          </div>
        )}

        {!loading && !error && (
          <div className="table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      {searchTerm ? (
                        <>
                          <p>No users match your search</p>
                          <button onClick={() => setSearchTerm('')} className="clear-search">
                            Clear Search
                          </button>
                        </>
                      ) : (
                        <p>No users found</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user._id} className="user-row">
                      <td>
                        <div className="user-info">
                          <div className="user-avatar">
                            {user.username?.charAt(0).toUpperCase()}
                          </div>
                          <div className="user-details">
                            <span className="user-name">{user.username}</span>
                            <span className="user-id">ID: {user._id.slice(-6)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="user-email">{user.email}</span>
                      </td>
                      <td>
                        <div className="role-controls">
                          <select
                            className="role-select"
                            value={user.role}
                            onChange={(e) => updateRole(user._id, e.target.value)}
                            disabled={updatingUserId === user._id}
                            style={{
                              borderColor: getRoleBadgeColor(user.role),
                              backgroundColor: `${getRoleBadgeColor(user.role)}10`
                            }}
                          >
                            <option value="participant">Participant</option>
                            <option value="coordinator">Coordinator</option>
                            <option value="admin">Admin</option>
                          </select>
                          {updatingUserId === user._id && (
                            <span className="updating-spinner"></span>
                          )}
                        </div>
                      </td>
                      <td>{formatJoinedDate(user.createdAt)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="details-btn"
                            onClick={() => setSelectedUser(user)}
                          >
                            Details
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => deleteUser(user._id)}
                            disabled={deletingUserId === user._id}
                          >
                            {deletingUserId === user._id ? (
                              <>
                                <span className="btn-spinner"></span>
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="delete-icon" aria-hidden="true" />
                                Delete
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="details-modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="details-header">
              <h3>User Details</h3>
              <button
                type="button"
                className="details-close-btn"
                onClick={() => setSelectedUser(null)}
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <div className="details-body">
              <div className="details-row">
                <span className="details-label">Full Name</span>
                <span className="details-value">{selectedUser.fullName || "N/A"}</span>
              </div>
              <div className="details-row">
                <span className="details-label">Username</span>
                <span className="details-value">{selectedUser.username || "N/A"}</span>
              </div>
              <div className="details-row">
                <span className="details-label">Email</span>
                <span className="details-value">{selectedUser.email || "N/A"}</span>
              </div>
              <div className="details-row">
                <span className="details-label">Role</span>
                <span className="details-value role-chip">
                  {selectedUser.role || "N/A"}
                </span>
              </div>
              <div className="details-row">
                <span className="details-label">Department</span>
                <span className="details-value">{selectedUser.department || "N/A"}</span>
              </div>
              <div className="details-row">
                <span className="details-label">Year</span>
                <span className="details-value">
                  {selectedUser.year ?? "N/A"}
                </span>
              </div>
              <div className="details-row">
                <span className="details-label">Account Status</span>
                <span className="details-value">
                  {selectedUser.isBanned ? "Restricted" : "Active"}
                </span>
              </div>
              <div className="details-row">
                <span className="details-label">Joined</span>
                <span className="details-value">
                  {formatJoinedDateTime(selectedUser.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ViewUsers;
