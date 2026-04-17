const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["admin", "participant", "coordinator"],
      required: true,
    },

    // Optional profile details (filled after login)
    fullName: { type: String },
    phone: { type: String },
    department: { type: String },
    year: { type: String },
    profileImage: { type: String, default: "default.png" },

    // Admin moderation fields
    isBanned: { type: Boolean, default: false },
    bannedUntil: { type: Date, default: null },
    banReason: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
