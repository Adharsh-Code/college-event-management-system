import React, { useEffect, useState } from "react";
import axios from "axios";
import { Check, Trash2, Upload, X } from "lucide-react";
import "./css/Profile.css";

const ALLOWED_DEPARTMENTS = ["Staff", "MCA", "MBA"];

function Profile() {
  const [profile, setProfile] = useState({
    username: "",
    email: "",
    fullName: "",
    phone: "",
    department: "",
    year: "",
    profileImage: "default.png",
    role: "",
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState({});

  const token = localStorage.getItem("token");
  const availableDepartments =
    ["admin", "coordinator"].includes(profile.role)
      ? ALLOWED_DEPARTMENTS
      : ALLOWED_DEPARTMENTS.filter((department) => department !== "Staff");

  const validateProfile = (values) => {
    const nextErrors = {};
    const fullName = (values.fullName || "").trim();
    const phone = (values.phone || "").trim();
    const department = values.department || "";
    const year = values.year ? String(values.year) : "";
    const allowedDepartments =
      ["admin", "coordinator"].includes(values.role)
        ? ALLOWED_DEPARTMENTS
        : ALLOWED_DEPARTMENTS.filter((entry) => entry !== "Staff");

    if (!fullName) {
      nextErrors.fullName = "Full name is required.";
    } else if (fullName.length < 2) {
      nextErrors.fullName = "Full name must be at least 2 characters.";
    } else if (!/^[A-Za-z\s.'-]+$/.test(fullName)) {
      nextErrors.fullName = "Use letters, spaces, apostrophes, periods, or hyphens only.";
    }

    if (!phone) {
      nextErrors.phone = "Phone number is required.";
    } else if (!/^\d{10}$/.test(phone)) {
      nextErrors.phone = "Phone number must be exactly 10 digits.";
    }

    if (!allowedDepartments.includes(department)) {
      nextErrors.department = "Select a valid department.";
    }

    if (department !== "Staff") {
      if (!year) {
        nextErrors.year = "Admission year is required.";
      } else if (!/^\d{4}$/.test(year)) {
        nextErrors.year = "Admission year must be a 4-digit year.";
      }
    }

    return nextErrors;
  };

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const res = await axios.get("http://localhost:3001/users/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!isMounted) return;
        setProfile(res.data);
      } catch (err) {
        console.log("Fetch error:", err);
        if (!isMounted) return;
        setMessage({ text: "Failed to load profile", type: "error" });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;

    if (name === "phone") {
      nextValue = value.replace(/\D/g, "").slice(0, 10);
    } else if (name === "year") {
      nextValue = value.replace(/\D/g, "").slice(0, 4);
    }

    const nextProfile = {
      ...profile,
      [name]: nextValue,
    };

    if (name === "department" && value === "Staff") {
      nextProfile.year = "";
    }

    const nextErrors = validateProfile(nextProfile);

    setErrors(nextErrors);
    setProfile({
      ...nextProfile,
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setMessage({ text: "Please select an image file", type: "error" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ text: "File size should be less than 5MB", type: "error" });
        return;
      }

      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setRemoveImage(false);
    }
  };

  const handleRemoveImage = () => {
    setRemoveImage(true);
    setSelectedFile(null);
    setPreviewUrl(null);
    const fileInput = document.getElementById("profileImage");
    if (fileInput) fileInput.value = "";
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }

    const normalizedProfile = {
      ...profile,
      fullName: (profile.fullName || "").trim(),
      phone: (profile.phone || "").trim(),
      year: profile.department === "Staff" ? "" : String(profile.year || "").trim(),
    };
    const validationErrors = validateProfile(normalizedProfile);

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setMessage({ text: "Please fix the highlighted fields.", type: "error" });
      return;
    }

    setProfile(normalizedProfile);

    const formData = new FormData();
    formData.append("fullName", normalizedProfile.fullName || "");
    formData.append("phone", normalizedProfile.phone || "");
    formData.append("department", normalizedProfile.department || "");
    formData.append("year", normalizedProfile.year || "");

    if (selectedFile) {
      formData.append("profileImage", selectedFile);
    } else if (removeImage) {
      formData.append("removeImage", "true");
    }

    try {
      const res = await axios.put("http://localhost:3001/users/profile", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage({ text: "Profile updated successfully!", type: "success" });

      if (res.data.user) {
        setProfile(res.data.user);
      } else {
        const refreshedProfile = await axios.get("http://localhost:3001/users/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setProfile(refreshedProfile.data);
      }

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setSelectedFile(null);
      }

      setRemoveImage(false);

      const fileInput = document.getElementById("profileImage");
      if (fileInput) fileInput.value = "";

      setTimeout(() => setMessage({ text: "", type: "" }), 3000);
    } catch (err) {
      console.log("PUT ERROR:", err.response?.data);
      setMessage({
        text: err.response?.data?.error || "Update failed",
        type: "error",
      });
    }
  };

  const getImageUrl = () => {
    if (previewUrl) return previewUrl;

    if (removeImage) {
      return "http://localhost:3001/uploads/default.png";
    }

    if (profile.profileImage && profile.profileImage !== "default.png") {
      return `http://localhost:3001/uploads/${profile.profileImage}`;
    }

    return "http://localhost:3001/uploads/default.png";
  };

  if (loading) {
    return (
      <div className="profile-loading-shell">
        <div className="profile-loading-card">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-header-copy">
          <h2>My Profile</h2>
          {/* <p>Review and update your account details, contact information, and profile photo.</p> */}
        </div>
        <div className="role-badge">
          <span className={`role-tag ${profile.role}`}>{profile.role?.toUpperCase()}</span>
        </div>
      </div>

      {message.text && <div className={`message-banner ${message.type}`}>{message.text}</div>}

      <div className="profile-panel">
        <div className="profile-image-section">
          <div className="profile-image-wrapper">
            <img
              src={getImageUrl()}
              alt="Profile"
              className="profile-image"
              onError={(e) => {
                e.target.src = "http://localhost:3001/uploads/default.png";
              }}
            />
            <div className="image-actions">
                <label
                  htmlFor="profileImage"
                  className="image-action-btn upload-btn"
                  title="Upload picture"
                >
                  <Upload className="action-icon" aria-hidden="true" />
                </label>
                {profile.profileImage !== "default.png" && !removeImage && !previewUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="image-action-btn remove-btn"
                    title="Remove picture"
                  >
                    <Trash2 className="action-icon" aria-hidden="true" />
                  </button>
                )}
              {removeImage && (
                <>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="image-action-btn confirm-btn"
                    title="Confirm remove"
                  >
                    <Check className="action-icon" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoveImage(false)}
                    className="image-action-btn cancel-btn"
                    title="Cancel remove"
                  >
                    <X className="action-icon" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
          <input
            type="file"
            id="profileImage"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          {removeImage && <p className="image-status">Will revert to default picture</p>}
          {previewUrl && <p className="image-status">New picture ready to upload</p>}
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={profile.username || ""}
              disabled
              className="disabled-input"
            />
            <small>Username cannot be changed</small>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={profile.email || ""}
              disabled
              className="disabled-input"
            />
            <small>Email cannot be changed</small>
          </div>

          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="fullName"
              value={profile.fullName || ""}
              onChange={handleChange}
              placeholder="Enter your full name"
              className={errors.fullName ? "field-invalid" : ""}
            />
            <small>This will the name placed on your certificate.</small>
            {errors.fullName && <small className="field-error">{errors.fullName}</small>}
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={profile.phone || ""}
              onChange={handleChange}
              placeholder="Enter your phone number"
              inputMode="numeric"
              maxLength={10}
              className={errors.phone ? "field-invalid" : ""}
            />
            {errors.phone && <small className="field-error">{errors.phone}</small>}
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label>Department</label>
              <select
                name="department"
                value={profile.department || ""}
                onChange={handleChange}
                className={errors.department ? "field-invalid" : ""}
              >
                <option value="">Select Department</option>
                {availableDepartments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
              {errors.department && <small className="field-error">{errors.department}</small>}
            </div>

            <div className="form-group half">
              <label>Admission Year</label>
              <input
                type="text"
                name="year"
                value={profile.year || ""}
                onChange={handleChange}
                placeholder="Enter admission year"
                inputMode="numeric"
                maxLength={4}
                disabled={profile.department === "Staff"}
                className={errors.year ? "field-invalid" : ""}
              />
              {errors.year && <small className="field-error">{errors.year}</small>}
            </div>
          </div>

          <button type="submit" className="update-btn">
            Update Profile
          </button>
        </form>
      </div>

      {/* {profile.createdAt && (
        <div className="profile-footer">
          <p>Member since: {new Date(profile.createdAt).toLocaleDateString()}</p>
        </div>
      )} */}
    </div>
  );
}

export default Profile;
