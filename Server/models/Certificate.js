const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    attendeeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    resultId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    certificateNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    recipientName: {
      type: String,
      required: true,
      trim: true,
    },
    recipientEmail: {
      type: String,
      default: "",
      trim: true,
    },
    department: {
      type: String,
      default: "",
      trim: true,
    },
    admissionYear: {
      type: String,
      default: "",
      trim: true,
    },
    eventTitle: {
      type: String,
      required: true,
      trim: true,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    eventEndDate: {
      type: Date,
      required: true,
    },
    venue: {
      type: String,
      default: "",
      trim: true,
    },
    coordinatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coordinatorName: {
      type: String,
      required: true,
      trim: true,
    },
    certificateType: {
      type: String,
      enum: ["participation", "achievement"],
      default: "participation",
      required: true,
    },
    rank: {
      type: Number,
      default: null,
    },
    achievementTitle: {
      type: String,
      default: "",
      trim: true,
    },
    issuedAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

certificateSchema.index({ participantId: 1, eventId: 1, certificateType: 1 }, { unique: true });

module.exports = mongoose.model("Certificate", certificateSchema);
